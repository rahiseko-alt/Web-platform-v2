# apps/web の AGENTS.md（web-platform）

ルート `AGENTS.md` の普遍ルールと初期化フローに従って決定した内容をここに記載する。
この案件（web-platform）は `rahiseko-alt/web-platform` から移植した既存プロダクトであり、
下記スタックは移植元リポジトリの `CLAUDE.md`（2026-07-13 起草・マスター確定済み）を引き継いだもの。

> **最初の成果物は原子ツリー（例外なし）**：スタックの引き継ぎは完了しているが、`docs/roadmap.html`
> は白紙テンプレ（`meta.template:true`）のまま。実装を続ける前に、この案件のゴールを頂点にした
> 原子分解ツリーを描き直す必要がある（ルート `AGENTS.md`「案件の絶対起点」を参照）。

## 概要

完成HTMLの量産ではなく「ページ構成×デザインシステム×セクション部品×業種別コンテンツ」の組合せで
100種類以上のWebサイトを生成できる共通基盤。販売はSTEP1（テンプレ制作代行）→STEP2（顧客編集SaaS）→
STEP3（AI自動編集オプション）の順に段階展開する。

## 技術スタック（移植元 `web-platform/CLAUDE.md` §0/§2 から引き継ぎ・確定済み）

- クラウド / ホスティング: Vercel（予定。DB/ストレージ/認証/決済の具体は要検討）
- 言語 / ランタイム: TypeScript / Node.js
- フレームワーク: Next.js（App Router） + React + Tailwind CSS
- パッケージ / 依存管理: pnpm（このリポジトリのworkspace管理下。移植元は npm 単体だったため package-lock.json は持ち込まず、pnpm-lock.yaml に統合済み）
- DB / データアクセス: PostgreSQL + Drizzle ORM（ローカル/CI既定は `@electric-sql/pglite` の組み込みDBにフォールバック。`DATABASE_URL` 未設定時は `PGLITE_DATA_DIR` を使用）
- 認証: Better Auth
- IaC / デプロイ: Vercel（未接続。`apps/web/vercel.json` に framework=nextjs / install=`pnpm install --frozen-lockfile` / build=`pnpm --filter web build` を設定済み。接続後、`.github/workflows/prod-smoke.yml` の `PROD_URL` を設定する）
- テスト: Vitest（`apps/web/tests`、CI で実行）＋ Playwright（`apps/web/tests/e2e`、E2E）
- Lint / フォーマッタ: ESLint（flat config）

## コマンド

- セットアップ: `pnpm install`
- 開発: `pnpm --filter web dev`
- ビルド: `pnpm --filter web build`
- 型チェック: `pnpm --filter web typecheck`
- Lint: `pnpm --filter web lint`
- テスト: `pnpm --filter web test`
- E2E: `pnpm --filter web e2e`
- DBスキーマ生成/反映: `pnpm --filter web db:generate` / `pnpm --filter web db:push`

## この案件固有のルール / メモ（移植元 `web-platform/CLAUDE.md` §1〜§3 から引き継ぎ）

- **作りやすさで成果物を選ばない。** 成果物は「作れるもの」ではなく「価値のあるもの」を出す。判定基準は
  人間（マスター）。ターゲットや構成を「作りやすいから」で決めない。
- **大規模モノレポをいきなり組まない。** 単一Next.jsアプリでシンプルに保つ（ナイト業種向け版等の展開は、
  一般版の共通基盤が実際に必要になった時点で再検討する）。
- テンプレートはHTML複製でなく、JSON設定データ（ページ構成配列＋セクション種別配列＋コンテンツバインディング）
  として管理する。
- データモデル階層: users → organizations → sites → pages → sections → content_entries
- **1ファイル原則500行以内。** 機能追加は新規ファイル優先・import参照のみ。入れ子は3段以内。
- localStorage / DB保存処理の空catch（無音握りつぶし）禁止。
- デザインシステムはCSS変数（トークン）で管理し、テーマ切替で配色・書体・余白・角丸が一括変更される設計にする。

## 移植で持ち込まなかったもの（意図的な除外・要確認事項）

`rahiseko-alt/web-platform` にあった以下は、コード・ビルドに直接必要なもの以外として今回は持ち込んでいない。
必要になった時点で個別に移植元から取り出す。

- `memory.md` / `failures.md` / `hypotheses.md` / `risk-diagnosis.md` / `roadmap.md` / `roadmap-state.json`
  （移植元独自のロードマップ運用資産。このリポジトリでは `docs/roadmap.html` に一本化する）
- `docs/session-reports/` / `docs/research/` / `docs/prompts/` / `docs/architecture-decision-0.md` 等
- `design/`（ワイヤーフレーム・スクリーンショット・コンセプト文書）
- `.claude/hooks/` / `.claude/agents/`（implement-agent 等）/ `.claude/commands/`（移植元独自のフック群）
- `scripts/d2-render.mjs`（図の生成ツール）
- `archive/`（前身プロダクト `hp-customizer` の凍結資産。移植元リポジトリの外側にあり、このクローンには含まれていなかった）
