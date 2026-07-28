# A-4: ログイン済みでも、他人の所有物にはアクセスできない — 独立検証記録

対象：`docs/roadmap.html` ノード `A-4`
criteria：「別アカウントが所有するsiteIdを指定して編集画面/APIへアクセスすると拒否される」
verify：「実際に別アカウントのsiteIdでアクセスを試み、拒否（403/404等）されることを確認する」
判定者：`.claude/agents/independent-verifier.md`（作業した本人ではない独立サブエージェント）
実行日：2026-07-28 / 対象コミット：`1fe850d7dd0f4ccc6af3ede472320a9a0ed508be`（検証開始時の `git log -1`。検証中の作業ツリーに変更なし＝`git status --short` 出力ゼロ）
環境：`apps/web` 開発サーバー（`pnpm dev` / Next.js 15.5.22、`http://localhost:3000`）、DB は PGlite（`./.pglite`、`pnpm db:push` 済み）
対象実装：`apps/web/src/lib/api-guard.ts`（`requireSiteOwnership` / `requireSectionOwnership`）、
呼び出し元 `app/editor/[siteId]/page.tsx`、`app/api/content/[sectionId]/route.ts`、`app/api/content/[sectionId]/image/route.ts`
（呼び出し元は `grep -rn "requireSiteOwnership\|requireSectionOwnership" app` で網羅を確認。3箇所とも検証対象に含めた）

## 0. 検証用アカウント2件をサインアップ経由で作成

```
$ curl -s --noproxy '*' -i -X POST http://127.0.0.1:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"a4_userA_1785200461@example.com","password":"IdorVerifyA123!","name":"A4 User A 1785200461"}'
HTTP/1.1 200 OK
{"token":"uWgW74R9izpCYHYQtBwChlNPrdRTDv9u","user":{...,"id":"ec067a8f-b252-46ee-bcb1-898f4ebae371"}}

$ curl -s --noproxy '*' -i -X POST http://127.0.0.1:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"a4_userB_1785200461@example.com","password":"IdorVerifyB123!","name":"A4 User B 1785200461"}'
HTTP/1.1 200 OK
{"token":"QaUJhgEVeaOnuSU1VoHXZc9AW7nVOsx9","user":{...,"id":"430b6c40-253d-4470-87bf-80a494ebbbe7"}}
```

- ユーザーA `userId = ec067a8f-b252-46ee-bcb1-898f4ebae371`
- ユーザーB `userId = 430b6c40-253d-4470-87bf-80a494ebbbe7`

A-2 の前例に倣い、サインアップが自動発行するセッションは以降使わず、`/api/auth/sign-in/email` を叩いた
ログイン由来の cookie jar（`jarA.txt` / `jarB.txt`）だけを以降の検証に使用した（両者とも `get-session` で
それぞれ自分の `userId` を返すセッションが有効であることを確認済み）。

## 1. ユーザーAが所有する organization/site/page/section を独立プロセスからDBへ直接投入

現状、認証済みユーザーがサイトを新規生成してDB保存する経路（B-1/B-2）は未接続のため、「他人が所有する
siteId」を用意するには独立プロセスから直接DBへ書き込む必要があった。`app/api/seed/route.ts` の
`buildSeed()` は既存データを全削除してから再投入する破壊的操作のため使用せず、`@electric-sql/pglite` を
直接 import した一時スクリプト（`apps/web/__a4_seed_ownerA.mjs`、実行後に削除済み）で
`organizations`（`created_by` = ユーザーA）→ `sites`（`organization_id` = そのorg）→ `pages` → `sections`
の順で挿入した（`src/db/seed/index.ts` の投入順序＝FK/NOT NULL制約を満たす順を踏襲）。

```
$ node __a4_seed_ownerA.mjs ec067a8f-b252-46ee-bcb1-898f4ebae371
{"orgId":"ae168f4e-89f6-4019-958c-019680dc33bd","siteId":"7ed72f4e-cdb5-4029-8e98-7a3dc5be7b4f",
 "pageId":"66d8146f-6e4d-4001-83c5-d2e2910e8229","sectionId":"e4815a79-e615-4ce8-9a95-f836c81d3b90"}
```

独立プロセスからの再読み取りでも投入内容を確認した（`organizations.created_by` がユーザーAの userId と一致）。

```
$ node __a4_check.mjs 7ed72f4e-cdb5-4029-8e98-7a3dc5be7b4f
sites row = [{"id":"7ed72f4e-...","organization_id":"ae168f4e-...", ... ,"created_by":"ec067a8f-b252-46ee-bcb1-898f4ebae371", ...}]
org join = [{"id":"ae168f4e-...","created_by":"ec067a8f-b252-46ee-bcb1-898f4ebae371"}]
sections count = [{"c":1}]
pages count = [{"c":1}]
```

### 1-1. 偽陽性の排除：PGliteへの直接書き込みは、稼働中サーバーへは即座に反映されない

直接書き込み直後に `curl -b jarA.txt http://127.0.0.1:3000/editor/<siteId>` を叩いたところ、**所有者本人でも
404** が返った（下記）。PGlite は単一プロセスの組込みエンジンで、稼働中の Next.js サーバープロセスが既に
開いている接続とは別に、独立プロセスが同じデータディレクトリを開いて書き込んでも、稼働中プロセス側の
メモリ上の状態には自動反映されないことを、この404で確認した。

```
$ curl -s --noproxy '*' -i -b jarA.txt "http://127.0.0.1:3000/editor/7ed72f4e-..."
HTTP/1.1 404 Not Found   ← 所有者本人なのに404＝サーバー側が新規行を認識していない
```

これは「所有権チェックが正しく機能して拒否した」のではなく「サーバーがデータの存在自体を認識していない」
偽陽性の芽だったため、対処として開発サーバーを再起動（`kill` → `pnpm dev` 再実行、`http://localhost:3000/`
が200を返すまで待機）し、ディスク上の最新状態から読み直させた。再起動後、ログイン済みcookie（サーバー再起動
前に発行済み）は `get-session` で引き続き有効であることを確認してから、以降の本検証を実施した。

```
$ curl -s --noproxy '*' -b jarA.txt http://127.0.0.1:3000/api/auth/get-session
{"session":{...,"userId":"ec067a8f-b252-46ee-bcb1-898f4ebae371",...},"user":{...}}
$ curl -s --noproxy '*' -b jarB.txt http://127.0.0.1:3000/api/auth/get-session
{"session":{...,"userId":"430b6c40-253d-4470-87bf-80a494ebbbe7",...},"user":{...}}
```

## 2. 画面パス `/editor/<siteId>`：対照実験（所有者）とIDOR試行（非所有者）

```
$ curl -s --noproxy '*' -o /dev/null -w "HTTP=%{http_code}\n" -b jarA.txt "http://127.0.0.1:3000/editor/7ed72f4e-..."
HTTP=200

$ curl -s --noproxy '*' -o /dev/null -w "HTTP=%{http_code}\n" -b jarB.txt "http://127.0.0.1:3000/editor/7ed72f4e-..."
HTTP=404
```

本文も確認した。ユーザーA（所有者）は編集画面（見出し「サイト編集」）が返る。

```
$ curl -s --noproxy '*' -i -b jarA.txt "http://127.0.0.1:3000/editor/7ed72f4e-..."
HTTP/1.1 200 OK
...
サイト編集
プレビューを開く
```

ユーザーB（非所有者）は404本文（Next.jsの `notFound()` 出力）が返る。

```
$ curl -s --noproxy '*' -i -b jarB.txt "http://127.0.0.1:3000/editor/7ed72f4e-..."
HTTP/1.1 404 Not Found
...
404
This page could not be found
```

＝ `app/editor/[siteId]/page.tsx` のコメント通り、`requireSiteOwnership` が返す 401/403/404 のいずれも
`notFound()` に丸められ、画面上は一律404として表示される設計（エラー詳細を隠蔽する設計）。所有者は
200・非所有者は404という別々の結果になっており、「常に404」の壊れた実装ではないことも対照実験で確認した。

## 3. APIパス `/api/content/<sectionId>`（`requireSectionOwnership`）：ステータスコードの切り分け

こちらは画面と異なり `guard.status` をそのまま返すため、403/404/401の切り分けが直接確認できる。

対照実験（所有者Aが自分のsectionへPATCH）：

```
$ curl -s --noproxy '*' -i -b jarA.txt -X PATCH "http://127.0.0.1:3000/api/content/e4815a79-..." \
    -H "Content-Type: application/json" -d '{"key":"heading","value":"hello from owner A"}'
HTTP/1.1 200 OK
{"ok":true}
```

IDOR試行（非所有者Bが所有者AのsectionへPATCH）：

```
$ curl -s --noproxy '*' -i -b jarB.txt -X PATCH "http://127.0.0.1:3000/api/content/e4815a79-..." \
    -H "Content-Type: application/json" -d '{"key":"heading","value":"hacked by user B"}'
HTTP/1.1 403 Forbidden
{"error":"Forbidden"}
```

副作用が無いことをDB直読みで確認した（ユーザーBのPATCHは反映されず、ユーザーAの値のみ残っている）。

```
$ node __a4_check_content.mjs e4815a79-...
content_entries = [{"key":"heading","value":"hello from owner A","created_by":"ec067a8f-b252-46ee-bcb1-898f4ebae371"}]
```

画像アップロードAPI（`app/api/content/[sectionId]/image/route.ts`）も同じ `requireSectionOwnership` を
アップロード処理より前に呼んでいる実装のため、同様にIDOR試行が拒否されることを確認した。

```
$ curl -s --noproxy '*' -i -b jarB.txt -X POST "http://127.0.0.1:3000/api/content/e4815a79-.../image" \
    -F "file=@fake.png;type=image/png"
HTTP/1.1 403 Forbidden
{"error":"Forbidden"}
```

## 4. 参考：存在しないID（403との切り分け）

所有権チェック対象のレコード自体が存在しない場合は404になり、「存在するが所有権が無い」の403とは
区別されることも確認した（criteria対象外・参考情報）。

```
$ curl -s --noproxy '*' -o /dev/null -w "HTTP=%{http_code}\n" -b jarB.txt \
    "http://127.0.0.1:3000/editor/00000000-0000-4000-8000-000000000000"
HTTP=404

$ curl -s --noproxy '*' -i -b jarB.txt -X PATCH \
    "http://127.0.0.1:3000/api/content/00000000-0000-4000-8000-000000000000" \
    -H "Content-Type: application/json" -d '{"key":"heading","value":"x"}'
HTTP/1.1 404 Not Found
{"error":"Not found"}
```

## 5. 実ブラウザ（Chromium / Playwright）での確認

`/opt/pw-browsers/chromium` を Playwright で起動し、`app/(auth)/login/page.tsx` の実フォームからユーザーA・
ユーザーBそれぞれでログインし、User Bのブラウザコンテキストから実際にUser Aの `/editor/<siteId>` へ遷移させた
（スクリプトは検証専用の一時ファイルとして `apps/web/__a4verify_browser.mjs` に作成し、実行後に削除済み）。

初回実行時、直前の複数回のcurlログイン試行と合わさって better-auth 組込みのsign-inレート制限
（`rateLimit.enabled: true`。sign-in系は既定で window:10s max:3）に触れ、ブラウザからの signIn が401
（本物のレート制限。アプリのバグではないことを `/api/auth/sign-in/email` のレスポンス本文で確認）になる
偽陽性が一度発生したため、時間を空けて再実行し、以下の実結果を得た。

```
[A][0] cookies after login = ["better-auth.session_token"]
[A][1] status = 200
[A][1] url = http://localhost:3000/editor/7ed72f4e-cdb5-4029-8e98-7a3dc5be7b4f
[A][1] h1 = サイト編集
[B][0] cookies after login = ["better-auth.session_token"]
[B][1] status = 404
[B][1] url = http://localhost:3000/editor/7ed72f4e-cdb5-4029-8e98-7a3dc5be7b4f
[B][1] visible body text (first 200 chars) = "404\nThis page could not be found."
```

＝ 実ブラウザでも、所有者Aは編集画面（見出し「サイト編集」）が実際に表示され、非所有者Bは同じURLへ
遷移しても画面が「404 This page could not be found.」になる（URL自体はリダイレクトされず同じ
`/editor/<siteId>` のまま＝A-3のログイン誘導とは異なる、所有権拒否特有の挙動であることも確認した）。

## 結論

**A-4: PASS**。

決め手：

1. 画面パス `/editor/<siteId>`：所有者（ユーザーA）は200・編集画面が表示され、非所有者（ユーザーB、同じ
   siteIdを指定）は404（`notFound()`）になる。curl・実ブラウザ（Chromium）の両方で確認した。
2. APIパス `PATCH /api/content/<sectionId>`：所有者は200で更新が反映され、非所有者は403 `{"error":"Forbidden"}`
   が返り、DB直読みで実際に更新が反映されていない（副作用が無い）ことも確認した。
3. 画像アップロードAPI `POST /api/content/<sectionId>/image` も同じガード関数を使っており、非所有者は
   ファイル送信前の所有権チェックで403になることを確認した。
4. 対照実験として所有者本人のアクセスは常に通過することを確認し、「常に拒否する」壊れた実装ではないことを
   示した。
5. 参考情報として、存在しないID自体は404、存在するが所有権が無いものは403、と区別されることも確認した
   （criteria自体は「403/404等」で両方を許容している）。
6. 検証過程で2件の偽陽性の芽を検出・排除した：(a) 独立プロセスからのPGlite直接書き込みは稼働中サーバーへ
   即時反映されないため、サーバー再起動で解消したこと、(b) better-authの組込みsign-inレート制限による
   一時的な401は、アプリの認可バグではなくレート制限自体であることをレスポンス本文で確認したこと。
   いずれも「たまたま緑/たまたま赤」を鵜呑みにせず原因を特定した。
