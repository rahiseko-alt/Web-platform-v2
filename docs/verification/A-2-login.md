# A-2: 作成したアカウントでログインでき、セッションが確立する — 独立検証記録

対象：`docs/roadmap.html` ノード `A-2`
criteria：「A-1で作成したアカウントで実際にログインでき、セッションが確立する」
verify：「実際にログインし、セッションが確立していること（再読み込みしてもログイン状態が保たれる等）を確認する」
判定者：`.claude/agents/independent-verifier.md`（作業した本人ではない独立サブエージェント）
実行日：2026-07-27 / 対象コミット：`f151fdb`（検証開始時の `git log -1`）
環境：`apps/web` 開発サーバー（`pnpm dev` / Next.js 15.5.22）、DB は `apps/web/.pglite`（PGlite）

前提：PGlite は新規のため、まず検証用アカウントを1件作成した（A-1 は検証済みのため API で作成）。

## 0. 検証用アカウントの作成（A-2 の前提）

```
$ curl -s --noproxy '*' -i -X POST http://127.0.0.1:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"verifier_a2_1785120739@example.com","password":"LoginVerify123!","name":"A2 Verifier 1785120739"}'
HTTP/1.1 200 OK
set-cookie: better-auth.session_token=jckEWxi5c4JvvzSO9yS3NMrUsmjKGbne.kZbhVjf%2B1sk9Znt6gMl4LSus5gM4WGMcjfe0wQHUVNY%3D; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
{"token":"jckEWxi5c4JvvzSO9yS3NMrUsmjKGbne","user":{...,"email":"verifier_a2_1785120739@example.com","id":"ee876c80-2424-43d0-8ee5-d146ea3794c5"}}
```

**サインアップが自動発行するセッションは以降一切使わない**（それを使うと「ログインできた」の証明にならないため）。
以降の検証は、白紙の cookie ジャーで `/api/auth/sign-in/email` を叩いて得た **ログイン由来の cookie だけ** を使う。

## 1. ログイン（API 経路）とセッション確立

```
$ curl -s --noproxy '*' -i -c login_jar.txt -X POST http://127.0.0.1:3000/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{"email":"verifier_a2_1785120739@example.com","password":"LoginVerify123!"}'
HTTP/1.1 200 OK
set-cookie: better-auth.session_token=jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL.JEsgTZep8ewrDHmPcaQLPulTjlMGnaANgPLq8bBcLMg%3D; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
{"redirect":false,"token":"jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL","user":{...,"id":"ee876c80-2424-43d0-8ee5-d146ea3794c5"}}
```

トークン `jhfH8juS...` はサインアップ時の `jckEWxi5...` と別値＝ログインが新しいセッションを発行している。

HTTP 200 だけを根拠にせず、その cookie **のみ** を使った別リクエストでセッションが引けることを確認した（再読み込み相当）。

```
$ curl -s --noproxy '*' -H "Cookie: better-auth.session_token=jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL.JEsgTZep8ewrDHmPcaQLPulTjlMGnaANgPLq8bBcLMg%3D" \
    http://127.0.0.1:3000/api/auth/get-session
{"session":{"expiresAt":"2026-08-03T02:52:45.396Z","token":"jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL","createdAt":"2026-07-27T02:52:45.397Z",
"ipAddress":"127.0.0.1","userAgent":"curl/8.5.0","userId":"ee876c80-2424-43d0-8ee5-d146ea3794c5","id":"9ec1baf3-f59e-4954-b58e-ebdb35e76945"},
"user":{"email":"verifier_a2_1785120739@example.com","id":"ee876c80-2424-43d0-8ee5-d146ea3794c5",...}}
HTTP=200
```

## 2. 偽陽性の排除（その cookie が本当に効いているか）

`get-session` は未認証時も HTTP 200 を返し **本文が `null`** になる仕様のため、判定は本文で行う。

```
$ (2) cookie 無し                       -> null   (HTTP=200)
$ (3) 署名の末尾1文字を X に改変        -> null   (HTTP=200)
$ (4) 署名はそのまま・トークン部を差替  -> null   (HTTP=200)
$ (5) でたらめな値 totally-made-up-value -> null  (HTTP=200)
$ (6) DB内の生トークン（署名を付けない）-> null   (HTTP=200)
$ (7) 別ユーザーBの署名をAのトークンに接合 -> null (HTTP=200)
```

`(1)` の正しい cookie だけが同一ユーザーのセッションを返し、上記いずれの改変でも引けない。
＝ 200 が常に返る類の偽の緑ではなく、cookie の値と署名が実際に判定に効いている。

## 3. 実ブラウザ（Chromium）で、実際のログイン画面から（画面・再読み込み）

`/opt/pw-browsers/chromium` を Playwright で起動し、`app/(auth)/login/page.tsx` のフォームに入力・送信した。
（スクリプト：`browser4.mjs`。実出力そのまま）

```
[0] cookies before login = []
[0] session before login = {"status":200,"body":"null"}
[1] POST /api/auth/sign-in/email -> 200
[1] url after login = http://localhost:3000/editor
[1] visible text after login = 404 This page could not be found.
[1] cookies after login = [{"name":"better-auth.session_token","httpOnly":true,"sameSite":"Lax","expires":1785725863.259939}]
[2] url after reload = http://localhost:3000/editor
[2] session after reload = {"status":200,"body":"{\"session\":{...\"token\":\"cAHcrdYrznoksjrAy8xSCCeNyOXH4iV8\",
     \"userId\":\"ee876c80-2424-43d0-8ee5-d146ea3794c5\"},\"user\":{\"email\":\"verifier_a2_1785120739@example.com\",...}}"}
[3] session in new tab = {... 同一 session id 07c3167c-c7f8-47bc-94ab-20dc475fab3d / 同一 userId ...}
[4] session with tampered cookie = {"status":200,"body":"null"}
[5] session with no cookie = {"status":200,"body":"null"}
[6] session with restored cookie = {... 再び同一セッションが引ける ...}
```

- ブラウザが保持した cookie は `HttpOnly` + `SameSite=Lax`、有効期限は7日後。
- **F5 相当の完全リロード後もログイン状態が保たれる**（[2]）。新規タブでも同一セッション（[3]）。
- 同じブラウザで cookie を壊す/消すと引けなくなり、戻すと再び引ける（[4][5][6]）＝偽陽性ではない。

## 4. プロセスをまたいでも同じ判断になるか（サーバー再起動＋独立プロセスからのDB直読み）

開発サーバーを停止（`kill -TERM 4147 4162 4181` → ポート3000は接続不可 `HTTP=000`）した状態で、
**サーバーとは無関係の独立 Node プロセス**から `.pglite` を直接開いて確認した。

```
$ node dbcheck.mjs jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL cAHcrdYrznoksjrAy8xSCCeNyOXH4iV8
sessions joined users = [
 {"id":"9ec1baf3-f59e-4954-b58e-ebdb35e76945","token":"jhfH8juS8BO3JvXQ9TBFAcQ9lY8dM6kL",
  "user_id":"ee876c80-2424-43d0-8ee5-d146ea3794c5","expires_at":"2026-08-03T02:52:45.396Z",
  "ip_address":"127.0.0.1","email":"verifier_a2_1785120739@example.com"},
 {"id":"07c3167c-c7f8-47bc-94ab-20dc475fab3d","token":"cAHcrdYrznoksjrAy8xSCCeNyOXH4iV8",
  "user_id":"ee876c80-2424-43d0-8ee5-d146ea3794c5","expires_at":"2026-08-03T02:57:43.247Z",
  "ip_address":"127.0.0.1","email":"verifier_a2_1785120739@example.com"}
]
users = [{"id":"ee876c80-2424-43d0-8ee5-d146ea3794c5","email":"verifier_a2_1785120739@example.com","name":"A2 Verifier 1785120739"}]
accounts = [{"provider_id":"credential","user_id":"ee876c80-...","password_prefix":"20d45f60ff84","password_len":161}]
```

（パスワードは平文でなくハッシュとして格納されていることも同時に確認。）

その後、開発サーバーを**新しいプロセスとして起動し直し**（新 PID 16935）、**旧プロセス時代に得た cookie だけ**を送った。

```
$ curl -s --noproxy '*' -H "Cookie: better-auth.session_token=jhfH8juS...%3D" http://localhost:3000/api/auth/get-session
{"session":{... "id":"9ec1baf3-f59e-4954-b58e-ebdb35e76945","userId":"ee876c80-..."},"user":{"email":"verifier_a2_1785120739@example.com",...}}
HTTP=200

$ curl -s --noproxy '*' -H "Cookie: better-auth.session_token=cAHcrdYr...%3D" http://localhost:3000/api/auth/get-session   # ブラウザで得た cookie
{"session":{... "id":"07c3167c-c7f8-47bc-94ab-20dc475fab3d","userId":"ee876c80-..."},"user":{...}}
HTTP=200

$ 対照：同 cookie の署名末尾を X に改変 -> null (HTTP=200)
```

＝ セッションはプロセス内メモリではなく DB に永続化されており、サーバープロセスをまたいでも同一判断になる。

## 5. ログインが「常に成功する」実装でないこと

```
$ 誤ったパスワード（正しいメール）
{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}   HTTP=401  （Set-Cookie 無し）

$ 存在しないメール
{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}   HTTP=401  （Set-Cookie 無し）

$ 正しい資格情報（対照）
HTTP/1.1 200 OK + set-cookie: better-auth.session_token=...
```

サーバーログ側も `WARN [Better Auth]: Invalid password` / `WARN [Better Auth]: User not found` と別理由で記録。
ブラウザ経由で誤パスワードを送った場合も画面に「メールアドレスまたはパスワードが正しくありません」が表示され、
cookie は1つも発行されなかった（`[5] cookies in that context = []`）。

さらに、セッションが「誰か1人を返すだけ」ではなくログインした本人に紐づくことを、2人目のアカウントで確認した。

```
$ cookie A -> verifier_a2_1785120739@example.com  ee876c80-2424-43d0-8ee5-d146ea3794c5
$ cookie B -> verifier_a2b_1785121246@example.com 16776723-4e92-46bb-a2ca-a1e3f86fb064
$ B のメール + A のパスワード -> {"code":"INVALID_EMAIL_OR_PASSWORD"} HTTP=401
```

## 6. 範囲外の発見（A-2 の criteria では判定しないが記録する）

1. **ログイン後の遷移先 `/editor` が存在せず 404**。`login/page.tsx` は成功時 `router.push('/editor')` するが、
   `app/editor/` には `[siteId]/` しか無い。実ブラウザ検証で `url after login = http://localhost:3000/editor` /
   `visible text = 404 This page could not be found.` を観測。セッション確立（A-2の事実）は成立しているが、
   利用者から見た体験は「ログイン→404」。C 以降の一覧/編集画面の葉で解消されるべき事項として記録する。
2. **`http://localhost:3000` 以外のオリジンからはログインが 403 になる**（`ERROR [Better Auth]: Invalid origin`）。
   `src/auth/index.ts` に `baseURL` / `trustedOrigins` の指定が無く、`BETTER_AUTH_URL` も `.env.example` に無いため、
   信頼オリジンが実質 `http://localhost:3000` 固定になっている。実測：

   ```
   Host=localhost   Origin=http://localhost:3000    -> 200
   Host=localhost   Origin=http://127.0.0.1:3000    -> 403
   Host=localhost   Origin=http://evil.example.com  -> 403   （CSRF 防御自体は効いている）
   Host=127.0.0.1   Origin=http://127.0.0.1:3000    -> 403   （同一オリジンでも拒否）
   Host=127.0.0.1   Origin=http://localhost:3000    -> 200
   ```

   本番ドメインへデプロイした場合、`BETTER_AUTH_URL`（または `baseURL`）未設定のままだとブラウザからのログインが
   403 になる可能性が高い。E（本番稼働）の葉で必ず実ドメイン上のログインを検証すること。
3. 上記 403 の際、画面には「メールアドレスまたはパスワードが正しくありません」と表示される（原因が資格情報でなくても同文言）。
   意図的なエラー隠蔽（`docs/design-notes.md` §4-1）の副作用として記録。
4. dev モードでハイドレーション完了前に送信ボタンを押すと、`onSubmit` が効かず素の form GET（`/login?`）になり、
   資格情報が送信されないまま無反応に見える。検証1回目はこれで空振りした（本番ビルドでの再現性は未確認）。

## 結論

**A-2: PASS**。

決め手は次の4点で、いずれも「HTTP 200 が返った」以外の独立した事実である。

1. ログイン由来の cookie **のみ**を使った別リクエストで、同一 `userId` のセッションが引ける（再読み込み相当）。
2. 実ブラウザで実際のログイン画面から成功し、完全リロード・別タブでもログイン状態が保たれる。cookie を壊す/消すと
   引けなくなり、戻すと再び引ける（真陽性・偽陽性の両方向で確認）。
3. サーバープロセスを停止 → 独立プロセスから `.pglite` を直接読み、セッション行が該当ユーザーに紐づいて永続化されている
   ことを確認 → 新プロセスで再起動しても旧 cookie がそのまま通る。
4. 誤ったパスワード・存在しないメールは 401 で cookie を発行せず、別ユーザーの cookie は別ユーザーを返す
   （「常に成功する／誰かを返すだけ」の実装ではない）。
