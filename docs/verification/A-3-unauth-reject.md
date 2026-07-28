# A-3: ログインしていないと保護ページに到達できない — 独立検証記録

対象：`docs/roadmap.html` ノード `A-3`
criteria：「未ログイン状態で保護ページ/APIへアクセスすると拒否される」
verify：「実際に未ログイン状態で保護ページへアクセスし、拒否される（ログイン画面へ誘導される等）ことを確認する」
判定者：`.claude/agents/independent-verifier.md`（作業した本人ではない独立サブエージェント）
実行日：2026-07-28 / 対象コミット：`0dddc4bd7d9e0e23bdb95e3dd094f697268c2f35`（検証開始時の `git log -1`。検証中の作業ツリーに変更なし＝`git status --short` 出力ゼロ）
環境：`apps/web` 開発サーバー（`pnpm dev` / Next.js 15.5.22、既に起動済みのプロセスをそのまま使用、`http://localhost:3000`）、DB は PGlite（`pnpm db:push` 済み）
対象実装：`apps/web/middleware.ts`（matcher: `/editor/:path*`, `/api/content/:path*`）

## 1. 画面パス `/editor/<siteId>` へ Cookie 無しでアクセス

```
$ curl -s --noproxy '*' -i http://localhost:3000/editor/some-fake-site-id-123
HTTP/1.1 307 Temporary Redirect
location: /login?redirect=%2Feditor%2Fsome-fake-site-id-123
Date: Tue, 28 Jul 2026 00:47:05 GMT
```

対照として `/editor`（サブパス無し）でも同様。

```
$ curl -s --noproxy '*' -i http://localhost:3000/editor
HTTP/1.1 307 Temporary Redirect
location: /login?redirect=%2Feditor
```

＝ 未ログイン状態で画面パスへアクセスすると `/login` へ 307 リダイレクトされ、元パスが `redirect` クエリに保持される。

## 2. API パス `/api/content/<path>` へ Cookie 無しでアクセス

```
$ curl -s --noproxy '*' -i http://localhost:3000/api/content/some-fake-path
HTTP/1.1 401 Unauthorized
content-type: application/json

{"error":"Unauthorized"}
```

サブパス無しの `/api/content` でも同様に 401。

```
$ curl -s --noproxy '*' -i http://localhost:3000/api/content
HTTP/1.1 401 Unauthorized
content-type: application/json

{"error":"Unauthorized"}
```

＝ 未ログイン状態で API パスへアクセスすると 401 JSON が返る。

## 3. 実ブラウザ（Chromium / Playwright）での確認

`/opt/pw-browsers/chromium` を `@playwright/test` の `chromium.launch` で起動し、Cookie を一切持たない
新規コンテキストから `/editor/<siteId>` へ直接ナビゲートした（スクリプトは検証専用の一時ファイルとして
`apps/web/__a3verify_browser.mjs` に作成し、実行後に削除済み）。

```
[0] cookies before nav = []
[1] final url = http://localhost:3000/login?redirect=%2Feditor%2Fsome-fake-site-id-999
[1] response status (last redirect leg) = 200
[1] response ok = true
[1] visible body text (first 300 chars) = "ログインログイン(self.__next_f=self.__next_f||[])..."
[1] first heading text = ログイン
[2] cookies after nav = []
```

＝ 実際にブラウザで `/editor/<siteId>` へ遷移させると、最終的な URL が `http://localhost:3000/login?redirect=...`
に変わり、画面の見出しも「ログイン」になっている（curl で見た 307 リダイレクトが実ブラウザでも画面遷移として
機能していることを確認）。

## 4. 偽陽性の排除（無効/改ざん Cookie でどうなるか。参考情報）

`middleware.ts` は Edge runtime のため DB 接続をせず、`getSessionCookie()` による **Cookie の存在チェックのみ**
（一次遮断）を行う設計（コード冒頭のコメントに明記）。二次防御は各 route/page 側の `auth.api.getSession()` に
委ねる設計のため、「存在するが不正な値」の Cookie は一次遮断を通過する。これは本 criteria の対象外だが、
設計通りかどうかの参考として記録する。

```
$ curl -s --noproxy '*' -D - -o /dev/null \
    -H "Cookie: better-auth.session_token=totally-bogus-invalid-token-value.XXXX...%3D" \
    http://localhost:3000/editor/some-fake-site-id-123
HTTP/1.1 404 Not Found

$ curl -s --noproxy '*' -i \
    -H "Cookie: better-auth.session_token=totally-bogus-invalid-token-value.XXXX...%3D" \
    http://localhost:3000/api/content/some-fake-path
HTTP/1.1 405 Method Not Allowed
```

＝ 改ざん Cookie は一次遮断（middleware）を通過し、その後の route/page 側の処理結果（存在しない siteId のため
404、`/api/content/[path]` に GET ハンドラが無いための 405 等）が返る。ログイン画面へのリダイレクトにはならない。
これはコード内コメントに書かれた設計（Cookie の存在のみを見る一次遮断・実体検証は下流に委ねる）と一致した挙動であり、
「Cookie さえあれば誰でも通る」バグではなく「一次遮断が Cookie 存在のみを見る設計」であることの追加確認である。
なお A-3 の criteria（未ログイン＝Cookie 無し、での拒否）はこの節の対象外。

## 5. 対照実験（matcher 対象外パスは通常通り表示されるか）

「常に拒否する」壊れた実装ではないことの確認として、matcher 対象外のパスに Cookie 無しでアクセスした。

```
$ curl -s --noproxy '*' -o /dev/null -w "HTTP=%{http_code}\n" http://localhost:3000/
HTTP=200

$ curl -s --noproxy '*' -o /dev/null -w "HTTP=%{http_code}\n" http://localhost:3000/login
HTTP=200

$ curl -s --noproxy '*' -w "\nHTTP=%{http_code}\n" http://localhost:3000/api/auth/get-session
null
HTTP=200
```

＝ `/`・`/login`・`/api/auth/get-session` はいずれも Cookie 無しで通常通り 200 が返る。middleware の matcher
（`/editor/:path*`, `/api/content/:path*`）で指定された範囲だけが拒否されており、全パスを機械的に落とす
壊れた実装ではないことを確認した。

（参考：`/preview/<id>` は matcher 対象外のため middleware では拒否されないが、存在しない id のため
500 が返った。これは middleware の認可拒否ではなくページ側のエラーであり、A-3 の criteria とは無関係。）

## 結論

**A-3: PASS**。

決め手：

1. 画面パス `/editor/<siteId>`（サブパス無しの `/editor` も含む）へ Cookie 無しでアクセスすると、307 で
   `/login?redirect=<元パス>` へリダイレクトされる（curl のヘッダで確認）。
2. 実ブラウザ（Chromium）でも同じ遷移が発生し、最終 URL が `/login?redirect=...` になり画面の見出しが
   「ログイン」であることを確認した（curl のステータスコードだけに依存しない、画面上の事実）。
3. API パス `/api/content/<path>`（サブパス無しの `/api/content` も含む）へ Cookie 無しでアクセスすると、
   401 と `{"error":"Unauthorized"}` が返る。
4. 対照実験として matcher 対象外の `/`・`/login`・`/api/auth/get-session` は Cookie 無しでも通常通り 200 が
   返ることを確認し、「常に拒否する」偽の緑（全パス一律拒否）ではないことを示した。
5. （参考・criteria 対象外）改ざん Cookie は一次遮断（Cookie 存在のみを見る設計）を通過するが、これは
   コード内コメントに明記された多層防御設計（二次防御は各 route/page が担当）どおりの挙動であり、
   ログイン画面への誘導にはならない。
