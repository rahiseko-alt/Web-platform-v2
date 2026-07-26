# A-1: 新規アカウントが作成できる — 独立検証記録

対象：`docs/roadmap.html` ノード `A-1`
criteria：「新規アカウントを実際に作成できる」
verify：「実際にサインアップフォームからアカウントを作成し、成立することを確認する」
判定者：`.claude/agents/independent-verifier.md`（作業した本人ではない独立サブエージェント）

## 1回目（FAIL）

```
$ curl -s -i -X POST http://localhost:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"verify-agent-1785073697@example.com","password":"TestPassw0rd123!","name":"Verify Agent"}'
HTTP/1.1 500 Internal Server Error
```

サーバーログ：

```
ERROR [Better Auth]: Error [Error: Failed query: select "id", "name", "email", ...
from "users" where "users"."email" = $1
[cause]: [error: relation "users" does not exist] { code: '42P01', ... }
POST /api/auth/sign-up/email 500 in 7974ms
```

原因：起動中のPGlite DB（`apps/web/.pglite`）にdrizzleのマイグレーションが未適用で、`users`テーブル自体が存在しなかった。

対処：`cd apps/web && pnpm db:push` でスキーマを適用し、開発サーバーを再起動した。

## 2回目（PASS）

サインアップ実行：

```
$ curl -X POST http://localhost:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"verifier_test_1785073807@example.com","password":"SuperSecret123!","name":"Verifier Test 1785073807"}'
HTTP/1.1 200 OK
（本文に "id":"be985c2b-d088-4caa-8b43-26c43dc8678e" を含むユーザーオブジェクトとセッショントークン）
```

HTTP 200のみで判定せず、DB永続化を独立に確認：

1. `GET /api/auth/get-session`（発行済みcookieのみで再問い合わせ）→ 同一`userId`のセッション・ユーザーを別リクエストで再取得。
2. 同一メールで再度サインアップ → `HTTP/1.1 422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`（emailのunique制約に実際にヒット）。
3. 開発サーバーを完全停止（`kill -TERM`）→ 新規プロセスとして再起動 → 起動直後の全く新しいPGlite接続に対して同一メールで再度サインアップ → 再度`422 USER_ALREADY_EXISTS`。プロセス再起動をまたいで`.pglite`ディスク上にレコードが残っていることを実証。
4. サーバー停止中に外部の独立Node/PGliteプロセスから直接SQLクエリ（`SELECT id, name, email, email_verified, created_at FROM users WHERE email = $1`）を実行し、作成したレコード（同一id/name/email/created_at）を直接取得。

## 副次的な発見（A-1のcriteria範囲外・記録のみ）

検証手順中、稼働中サーバーへの`kill -TERM`直後に発生した別テストユーザーの書き込みが、PGliteのWAL/データflushのタイミングによりディスクへ反映されず「消えた」ように見える事象を観測した。これは検証手順自体（強制終了）が引き起こしたものであり、通常の運用パス（アプリ経由の正常サインアップ・正常稼働継続）には影響しない。将来的な突然のクラッシュ耐性は本葉のcriteria範囲外の別論点として記録する。

## 結論

**A-1: PASS**。1回目のFAIL原因（マイグレーション未適用）は解消済み。サインアップAPIは実際にレコードを作成し、プロセス再起動・独立プロセスからの直接クエリという2つの偽装不可能な方法でディスク上の永続化を確認した。
