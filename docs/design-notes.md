# 設計ノート（コードが引用する設計根拠の実体）

## このファイルの位置づけと、作られた経緯

**このファイルは「失われた設計文書の復元」ではありません。現行コードから実際に読み取れる事実だけを
記録した索引です。**

`apps/web` のソースコメントは、当初 `docs/ai-agent-dev-method.md` / `docs/architecture-decision-0.md` /
`security-runtime.md` / `api-validation.md` / `wireframe.md` / `design-system.md` / `design/concept.md` /
`memory.md` / `plan stateful-painting-pebble.md` を「準拠元＝正」として引用していました。しかしこれらは
本リポジトリに存在せず、**git の全履歴を探しても一度も存在しません**（コードだけが前リポジトリから
移送され、根拠文書が置き去りになった）。したがって原文は復元不能です。

原文が読めないまま参照だけが残っていると、「この変更は根拠に準拠しているか」を後から検証できず、
根拠を無視した変更が積み上がります。そこで次の方針を採りました（ロードマップ `F-1`）。

- **推測で原文を書き起こさない**（読んでいない文書の中身を創作しない）。
- 代わりに、**現行コードを読めば確認できる決定事項だけ**をここに記録し、実装箇所を指す。
- 各項目には検証可能な実装位置を必ず添える。ここに書いていない「なぜその判断に至ったか」の議事は失われた
  ままであり、**失われたという事実自体を残す**（無かったことにしない）。
- 参照のリンク切れは `scripts/verify-doc-refs.mjs` が CI で毎回検出する（人手のレビューでは見落とすため）。

以下の各節は、旧参照名との対応を見出しに併記してあります。

---

## 1. データモデル階層（旧 `architecture-decision-0.md §1`）

**決定**：`users -> organizations -> sites -> pages -> sections -> content_entries` の階層で持つ。

- 実装：`apps/web/src/db/schema.ts`
- 所有権の主体は `organizations.createdBy`。組織メンバーの中間テーブルは**存在しない**ため、
  所有判定は `organizations.createdBy === session.user.id` の単純一致で行う。
- 帰結：メンバー招待・共同編集は現時点では表現できない（本フェーズのスコープ外）。

## 2. テンプレート構造（旧 `architecture-decision-0.md §2`）

**決定**：HTML を複製せず、**JSON 設定データ + コンポーネントレジストリ**で生成する。

- 実装：`apps/web/src/templates/types.ts`（`TemplateDefinition` / `PageComposition` / `DesignSpec`）、
  `apps/web/src/sections/registry.tsx`（`sectionType` -> React コンポーネントの解決表）。
- デザインは自由文ではなく**離散トークン**（`heroVariant` / `rhythm` / `align` / `sectionVariants` /
  `cardStyle` / `buttonShape`）で表し、`PageRenderer` がトークン→部品変種を決定的に写像する。
  自由文生成のステップを挟まないことで、モデルの最頻値（無難な平均形）への収束を構造的に避ける。

## 3. 権限構造（旧 `architecture-decision-0.md §4`）

**決定**：フェーズ1は **email/password のみ**。OAuth はスコープ外。

- 実装：`apps/web/src/auth/index.ts`（Better Auth + drizzle adapter）。
- `usePlural: true`：既存スキーマの複数形テーブル名（`users`/`sessions`/`accounts`/`verifications`）に
  Better Auth 側のモデル名を合わせるため。
- `advanced.database.generateId: false`：既存の uuid 主キー（Postgres `gen_random_uuid()` の DEFAULT）を
  維持するため、Better Auth 側の自前 ID 生成を無効化する。

## 4. 実行時セキュリティ規律（旧 `security-runtime.md`）

コード内で「エラー隠蔽」「レートリミット」「IDOR 対策」として参照されていた3つの規律。現行実装は次のとおり。

### 4-1. エラー隠蔽（詳細を返さない）

サーバー側の詳細をクライアントへそのまま返さず、抽象化したメッセージだけを返す。

- ログイン失敗：メール／パスワードのどちらが誤りかを区別しない（`app/(auth)/login/page.tsx`）。
- サインアップ失敗：重複メール等のサーバー詳細を出さない（`app/(auth)/signup/page.tsx`）。
- 所有権チェック失敗：編集画面では 401/403/404 を全て `notFound()` へ丸める。ステータスの区別は
  API 側でのみ行う（`app/editor/[siteId]/page.tsx`、`src/lib/api-guard.ts`）。
- 生成 API：OpenAI のエラー本文にはプロンプト等が混ざりうるため、そのまま返さずログに集約する
  （`app/api/generate/route.ts`）。

### 4-2. レートリミット

- 汎用の固定窓リミッタ：`apps/web/src/lib/rate-limiter.ts`（キー別カウンタ）。
- 適用箇所：認証（`src/auth/index.ts` の `rateLimit.enabled: true`。Better Auth の既定 special rule は
  production のみ有効なため、dev でも効くよう明示的に有効化）、content PATCH（10 秒窓・上限 20）、
  画像アップロード（10 秒窓・上限 5＝重い処理のため厳しめ）、seed（10 秒窓・上限 5）。
- **既知の制約**：いずれもプロセス内メモリのため、複数インスタンス／サーバレスでは共有されない。
  本番での共有化（Redis 等）は未実装の課題。

### 4-3. IDOR 対策（多層防御）

`middleware.ts` の Cookie 存在チェックは optimistic な第1層に過ぎない。実体の検証は毎リクエスト行う。

- `apps/web/src/lib/api-guard.ts` の `requireSiteOwnership` / `requireSectionOwnership` が、
  セッションの有効性と「リソースの organization を誰が `createdBy` したか」を必ず再検証する。
- `apps/web/src/lib/seed-guard.ts` は seed エンドポイントを (1) 本番遮断 (2) トークン fail-closed
  （`timingSafeEqual` による定数時間比較）(3) 固定窓レートリミット の3層で守る。

## 5. API 入力検証（旧 `api-validation.md`）

**決定**：外部入力は zod の `safeParse` で検証し、無制限入力を受けない。

- 実装：`apps/web/src/lib/validation/content.ts`（テキストは trim 後 1〜300 文字、色は小文字正規化のうえ
  `^#[0-9a-f]{6}$` のみ許可＝`javascript:` 等のスキーム混入はパターン不一致で拒否される）。
- 生成 API も同様に本文長を制限する（`app/api/generate/route.ts`：brief は 1〜2000 文字）。

## 6. 評価の二層構成（旧 `ai-agent-dev-method.md §3 / §5 / §6 / §7`）

### 6-1. LLM が返すのは値だけ（旧 §3）

生成ループでは、LLM は**要素の値**のみを返す。id/order の採番・組み立ては機械（`src/generate/validate.ts`）が
行う。JSON 崩れ・台帳外の値は握りつぶさず `Rejection` として表に出し、差し戻して再試行する。既定値での
無音フォールバックはしない（評価が回らなくなるため）。

- 実装：`apps/web/src/generate/generate.ts`、`apps/web/src/generate/validate.ts`。
- 評価（採点）はこのループの中に置かない。稼働と採点は分離する。

### 6-2. 機械 60 点 + judge 40 点（旧 §6）

配点の単一正本は `apps/web/src/eval/rubric.ts`。

| 層 | 内訳 | 満点 |
| --- | --- | --- |
| 機械（単票） | A 依頼文の反映 15 / B 文字数レンジ 12 / C 構成の妥当性 10 / D 誠実性 8 / E 非重複 5 | 50 |
| 機械（セット） | F 多様性（単票では測れないため分離） | 10 |
| LLM-judge | G トーン適合 15 / H コピーの主観品質 15 / I 総合完成度 10 | 40 |
| **合計** | | **100**（合格線 80） |

- **ゲートが既に拒否する項目には配点しない**：`validate.ts` が enum・セクション種別・並び・重複・項目数・
  プレースホルダを拒否するため、そこへ配点しても常に満点になり物差しにならない。採点はゲート通過後に
  残る品質だけを測る。
- 文字数レンジの正本は `src/generate/length-rules.ts` にあり、`rubric.ts` は再輸出するだけ。稼働ループの
  差し戻しと採点が同じレンジを見るため。
- **judge は人間較正が未実施**のため常に参考値として扱い、単独運用しない（`src/eval/judge.ts`、
  `src/eval/report.ts`）。judge 呼び出しの失敗は機械採点とは独立した失敗として扱う。

### 6-3. エラー分析と提示（旧 §5 / §7）

減点理由は `ScoreDetail.notes` に残し、人が後から読んで原因を分析できるようにする（`src/eval/score.ts`）。
集計は「テストケース × 項目」のマトリクスとして提示する（`src/eval/report.ts`）。

## 7. デザインシステムとワイヤーフレーム（旧 `design-system.md` / `wireframe.md`）

CSS カスタムプロパティの正本は `apps/web/app/globals.css`。コメントから参照される主なトークン：

- `--bleed-max`（フルブリード時の最大幅。`src/components/primitives/Container.tsx` の `bleed` が使う）
- `--tap-target-min: 44px`（タップ領域の下限。`src/components/primitives/Button.tsx` が使う）

ワイヤーフレーム由来の構成上の意図で、コードに残っているもの：

- `header-01`：「誰か」を1行で示しつつ、予約／電話を常時1タップに保つ。スクロールで縮む sticky ヘッダ
  （`.header-shrink`・JS 不要）と、モバイル常設 CTA バー（`.sticky-cta-bar`・`md:hidden`）は骨格変種
  （standard / centered-logo）によらず共通。
- `about-01`：院長・オーナーの顔を信頼シグナルとして扱う（`photo-band` 変種の意図）。

## 8. デモ用サンプルデータ（旧 `design/concept.md §5`）

**決定**：デモの 2 エグゼンプラは**架空の店舗**とし、実在の店舗名・人物名は使わない。

- 実装：`apps/web/src/db/seed/fixtures/section-content.ts`
  - `general-001` = あおば歯科・矯正クリニック（信頼シグナル・WEB 予約 24 時間・院長紹介）
  - `general-002` = salon lumi（世界観・仕上がり・営業時間外 WEB 予約）

## 9. 現時点でスコープ外と決まっているもの（旧 `memory.md` / `plan stateful-painting-pebble.md`）

コードコメントが「スコープ外」と明示していた事項。**根拠の議事は失われており、ここには決定内容のみ記録する。**

- サインアップ時の organization 紐付け（ユーザー登録のみ行う）— `app/(auth)/signup/page.tsx`
- 組織メンバーの招待・共同編集 — `src/lib/api-guard.ts`（所有権は `createdBy` 単純一致）
- OAuth ログイン — `src/auth/index.ts`
- サイト全体テーマの永続設定（現在は「ページ内で最初に見つかった `accentColor`」を site 全体へ渡す
  簡易ヒューリスティック）— `app/preview/[siteId]/[[...slug]]/page.tsx`
- レートリミット状態の複数インスタンス共有 — `src/lib/rate-limiter.ts` / `src/lib/seed-guard.ts`

これらを実装対象に戻す場合は、ロードマップ（`docs/roadmap.html`）に葉として追加してから着手すること。
