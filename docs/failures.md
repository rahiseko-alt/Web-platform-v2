# failures（失敗の蓄積ログ / append-only・消さない）

同じ失敗を繰り返さないための**蓄積型**ログ。handoff（`docs/roadmap.html` の `meta.handoff`・毎回上書き）とは
役割が違い、ここは**消さずに積む**。1件＝**日付＋事象＋根因＋教訓**。

---

## 2026-07-22 handoff が既マージ枝に取り残され次セッションに渡らなかった
- 事象：前回チェックアウトで handoff を、PR#14 が既にマージ済みのブランチ（`claude/language-granularity-verification-6mr28i`）
  先端へ余分に1コミット push（`af0d724`）。PR は既にクローズ/マージ済みのため main に取り込まれず、ブランチ上に取り残された。
  次セッションは main（旧 handoff）から生えたため読めなかった（＝消滅ではなく未マージの取り残し）。
- 根因：handoff が本編（毎PRで必ず main に乗る `docs/roadmap.html`）と別ファイル・別経路。マージ済み枝への追い push は main に届かない。
- 教訓：handoff は roadmap（`meta.handoff`）に同梱し、本編と一緒に必ずマージする。commit/push の自己申告を鵜呑みにせず存否を確認する。

## 2026-07-22 stale なローカル参照を鵜呑みにして「消滅」と誤断定
- 事象：`git cat-file -t af0d724` がローカルで「Not a valid object」を返したのを根拠に「af0d724 は消滅」と断言。
  実際は GitHub 上に実在（上記ブランチ先端）。ローカル clone の `origin/main` も stale（fef4360=Initial commit を指す）で、
  「main は空」とも誤断定した。真の main は cf22e57。
- 根因：ローカルの remote-tracking 参照が古いまま、リモート実データ（`git ls-remote` / GitHub API `list_branches`）で照合せず結論した。
  「本人の自己申告を信じない」を掲げながら、自分のローカル状態を自己申告として鵜呑みにした。
- 教訓：ブランチ/コミットの存否・main の位置は、**ローカルの `origin/*` ではなくリモート実データ**で確認してから断定する。

## 2026-07-22 roadmap-required の必須チェック名を job 名≠登録名で登録し、全PRをブロック
- 事象：`roadmap-required` を必須チェックに登録する際、登録名を **workflow 名**「roadmap-required」にした。だが GitHub Actions
  が報告するチェック名は **job 名**「PRにroadmap更新があるか（例外なし）」。両者が食い違い、必須コンテキスト「roadmap-required」が
  永久に未報告 → roadmap を更新した正当なPRを含め**全PRがマージ不能**（`405 Required status check "roadmap-required" is expected`）。
- 根因：Actions の必須チェック名は **job 名（check run 名）** と一致させる必要があるのに workflow 名で登録した。加えて
  「#17 が blocked」を「必須化が正しく機能」と早合点し、**pass→merge できることを確認せず「検証済み」と報告**した。
- 対処：job の `name` を `roadmap-required` に改名して報告名を登録名に一致させ、roadmap 更新PR(#18)が緑通過→マージ成立で実証。
- 教訓：必須チェックは「**blocked を観測」だけでなく「pass して merge できる**」ことまで実証して初めて"効く"証拠になる。
  GitHub Actions の必須チェックは `jobs.<id>.name` を登録名に一致させる。

## 2026-07-23 粒度ルールの「機械的判定手順」を語の単位を揃えずに書き、合格例と自己矛盾させた
- 事象：AGENTS.md の粒度ルールを「原子まで分解」で AI 解釈がぶれない形へ改訂する際、判定手順を
  ①「verify が『かつ』(=`&&`)で2本以上に割れるか」②「独立2つ以上の理由で落ちうるか」で書いた。だが直後の合格例
  `typecheck && lint && test`（=1葉）に literal 適用すると、①は `&&`×3 で YES、②は型/lint/test の3独立原因で YES となり
  「割れ」＝逆判定。手順どおり読む AI と例に従う AI で結論が割れ、狙い（解釈ぶれ排除）を自壊させた。第2の目(basis-reviewer)が反証。
- 根因：停止条件の真の単位は「独立して落ちうる**受入事実**」なのに、判定手順を「`&&` の数／失敗原因の数」という
  **別の単位**で書いた。事実(fact)と、その検証手段（コマンド）・内部失敗原因(reason)を混同した。
- 対処：判定を「その verify は独立して落ちうる**受入事実**を2つ以上含むか？」の1問へ統一。受入事実＝マスターが独立に
  受け入れ判定したい結果／能力と定義し、複合コマンド=1事実の例と、secret scanning＋push protection=2事実の例を手順内に明示。
  basis-reviewer.md の atomic 定義も同じ1問へ整合。
- 教訓：ルールの「機械的判定」は、数える**単位**を規律本体（=受入事実）と厳密に一致させる。コマンド数・`&&`・失敗原因は
  代理指標であって単位ではない。判定手順を書いたら、必ず既存の合格例に literal 適用して逆判定が出ないか自己テストする。

## 2026-07-23 承認3層化で「審判集合」を狭く定義し、AIが自分のCIを緩められる裏口を開けた（マージ前に第2の目が捕捉）
- 事象：承認負担の構造改革B案で審判集合（tier-2＝人間必須）を `.github/workflows/**`・`.github/scripts/**`・reviewers台帳・
  ルートAGENTS.md・roadmap描画エンジンだけで定義した。だが CI の「緑」の定義を実際に決めるのは各 `package.json` の
  `test`/`lint` scripts・直下 `scripts/verify-roadmap-evidence.mjs`（evidence偽造検査器）・`tsconfig*`/`pnpm-lock`/`.node-version` 等で、
  これらが tier-0 に落ちていた。AI が `"test":"echo ok"` へ書き換えたPRが人間もbotも通さず自分で緩めたCIで緑になり
  auto-merge される裏口。＝本改革の目的（本人採点の禁止）を正面から破る穴。第2の目(basis-reviewer)が反証し objection。
- 根因：「審判＝審判を動かす仕組み(workflows/scripts)」とだけ捉え、「審判＝緑の判定基準そのもの(scripts本体/config/依存固定)」を
  取りこぼした。守るべき対象を"入れ物"で列挙し"中身"を落とした。特に evidence 検査器が `.github/scripts/` でなく直下 `scripts/` に
  在ることを実測せず、名前の近さで被覆したつもりになった。
- 対処：tier-2 に各 `package.json`・`^scripts/`・`tsconfig*`/`vitest`/`eslint`/`pnpm-workspace`/`pnpm-lock`/`.node-version`/
  `.tool-versions`/`.npmrc` を追加（basis-gate.sh・AGENTS.md・docs/basis-gate.md を同期）。実装コード本体(apps/**/src)は tier-0 のまま。
  併せて auto-merge の自己チェック除外を部分一致→完全一致(job名 `auto-merge`)へ、skipped を緑扱いしない強化も実施。
- 教訓：「AI が自分の合格を偽造できる経路」を塞ぐときは、審判を動かす仕組みだけでなく**緑の判定基準を決める全ファイル**
  （scripts本体・各config・依存/ランタイム固定）まで含める。パスは思い込みでなく `git ls-files` で実測して被覆を確認する。
  基準を凍結する変更は必ず第2の目に敵対レビューさせてからマージへ回す（今回それが穴を捕捉した＝門が機能した実例）。

## 2026-07-23 branch protection 未設定のまま運用し、赤の tier-2 PR(#26)が手動マージで通った／handoff を tier-2 と束ね余計に手動を増やした
- 事象：tier-1 の bot 登録PR#26 は basis-gate が「tier-2 承認待ち」で赤だったが、**branch protection 未設定のため物理ブロックが効かず手動マージが通った**。
  結果、実稼働未確認の coderabbitai[bot] が tier-1 レビュアーとして main に載る footgun 化。さらに是正+handoff を1つのPR#27に束ねたため、
  本来 master のマージ不要な handoff(tier-0=roadmap meta+failures.md)まで tier-2 に巻き込み、master の手動マージを不要に増やした。
- 根因：①門を「赤/緑の信号」までしか作らず**物理強制(required status check)を有効化しないまま実運用**した＝ソフト信号は人が無視できる。
  ②tier-0(handoff)と tier-2(審判集合の変更)を**1PRに混載**した＝混ぜると全体が厳しい方(tier-2)に倒れ、自動で流れるはずの handoff まで手動化する。
- 対処：handoff を tier-0 単独PRに分離（auto-merge で master 操作なしに main へ）。bot是正(placeholder 戻し)は独立の tier-2 小PRに切り出す。
  次セッション最優先で branch protection を設定し basis-gate 等を必須チェック化（check名=job名一致）。
- 教訓：①門は「信号」だけでは守れない。**物理強制を入れて初めて赤が赤として効く**。②PRは tier をまたいで混載しない
  ＝tier-0(コード/文章/meta)と tier-2(審判集合)は別PRに割る。混ぜると自動で流れる分まで人間のマージ律速になる（＝改革の旨味を自分で消す）。

## 2026-07-23 自作 auto-merge.yml が「対象PRなし」で毎回空振り＝tier-0でも自動マージされなかった（実テストで発覚）
- 事象：tier-0 の handoff PR#28 は全11チェック緑・basis-gate=tier-0 success だったが auto-merge が一度もマージしなかった。実行ログは
  毎回 **「対象の open PR なし。」**＝ PR 一覧取得 `gh api "repos/$REPO/pulls?state=open&base=main&per_page=50" --jq '...'` が
  空を返し、マージ手前で continue/exit していた。結局 Claude が MCP の merge_pull_request で手動マージして handoff を main に載せた。
- 根因：①自作ワークフローの PR 列挙クエリが実環境で PR を拾えていない（`&base=main` 等のクエリ/トークン権限まわりの不備の疑い）。
  実イベントでは走っていた（status/pull_request で発火）ので「発火しない」ではなく「発火後の列挙が空」。②そもそも private 時代の
  自作 auto-merge は GITHUB_TOKEN 起因イベントが別ワークフローを再起動しない制約とも相性が悪く、堅牢でない。
- 対処(方針)：**公開化した今、自作 auto-merge.yml を捨て、GitHub ネイティブの auto-merge + branch protection に置換する**（次セッション）。
  ネイティブは「必須チェック緑で自動マージ」を公式提供し、GITHUB_TOKEN 制約や列挙バグの影響を受けない。＝物理強制(branch protection)と一体で入る。
- 教訓：自動化は「動くはず」で終わらせず**実PRで最後(マージ成立)まで通して確認**する。既製の堅牢機構(ネイティブ auto-merge)がある所を
  自作ワークフローで代替しない（特に GITHUB_TOKEN の再起動制約が絡む領域）。当座は tier-0 を Claude が MCP で直接マージすれば master は不介在。

## 2026-07-24 tier-1 bot の設定ファイル(.coderabbit.yaml)を審判集合から落としかけた／branch protection 物理強制はツールで実行不能と確定
- 事象：承認ゼロ化のため CodeRabbit を実稼働させる `.coderabbit.yaml`(`request_changes_workflow: true`) を追加する際、当初これを
  tier-0 のまま入れようとした（basis-gate の tier-2 リスト外）。tier-0 だと AI が後で `request_changes_workflow: false` 等へ勝手に
  緩め、tier-1 の反証(CHANGES_REQUESTED)機能を無力化する裏口になる（2026-07-23「審判集合を狭く定義」と同型の穴）。実装中に気づき
  tier-2 へ格上げした。加えて、branch protection の物理強制 ON は当セッションのツールでは実行不能と確定：MCP github に該当ツール
  無し／直 API は proxy が 403(GitHub access is not enabled)／`gh` CLI 無し。＝マスターが GitHub 画面で Ruleset を作る1操作が構造的に必須。
- 根因：①「bot が誰か(bot-reviewers.txt)」は審判集合に入れていたが「bot が**どう裁くか**(.coderabbit.yaml)」を見落とした＝審判の
  "中身"の取りこぼし。②「branch protection を設定する」を暗にツールで代行できると仮定しかけた（実際は admin の画面操作のみ）。
- 対処：basis-gate.sh の tier-2 判定に `.coderabbit.yaml` を追加し、AGENTS.md・docs/basis-gate.md の審判集合列挙にも明記。
  docs/basis-gate.md に「必須チェックに Require approvals を付けると tier-0 が formal Approve を持たず自作 auto-merge の
  GITHUB_TOKEN マージが永久ブロックされる」ことも明記（承認は basis-gate に一元化）。
- 教訓：①第2の目(bot)を導入する時は「誰が裁くか」だけでなく「どの設定でどう裁くか」の**設定ファイルまで審判集合に凍結**する。
  ②branch protection/Ruleset の作成・変更は **admin の画面操作のみ＝AI は代行不能**。手順を docs 化してマスターに委ねる（ツールで
  やろうとして空回りしない）。③承認は `basis-gate`(必須ステータスチェック)に一元化し、GitHub native の Require approvals は使わない
  （bot 承認を数えない＋GITHUB_TOKEN マージを殺す）。

## 2026-07-24 tier-2 の「マスターが自分のPRをApprove」は GitHub 仕様で不可能＝承認導線が破綻していた
- 事象：承認ゼロ化のため tier-2 PR(#30)をマスターに承認させようとしたが、GitHub は**PR作者が自分のPRをApproveできない**仕様。
  当リポの全PRは Claude Code が `rahiseko-alt`（＝マスター本人）名義で作成するため、basis-gate の tier-2「rahiseko-alt の APPROVED で緑」は
  **永久に満たせない**。＝branch protection で `basis-gate` を必須化し Bypass を空にすると、tier-2 は誰にも通せず全ルール変更がデッドロック。
- 根因：basis-gate のtier-2 承認を「GitHub formal Approve」に固定したが、作者=承認者が同一人物になる本運用（AIがマスター名義でPR作成）を
  考慮していなかった。過去の tier-2 PR は実は Approve ではなく**マスターの手動マージ**で通しており（＝承認導線は最初から機能していない）、
  branch protection 未設定ゆえ表面化していなかっただけ。
- 対処：tier-2 の承認＝**マスターが自分でMergeボタンを押す**行為に定義し直す。物理強制は「Bypass list にリポ管理者(マスター)を入れる」
  ＝AI(auto-merge/MCP)は必須チェック赤で物理ブロック・マスターだけが赤いtier-2を意図的にMergeできる、で実現（Bypass空は不可）。
  基準変更を機械承認で完全ロックしたい場合の次善は、Approveの代わりにマスターのコメント/ラベル信号をbasis-gateが読む改修（将来課題）。
- 教訓：承認の「導線」は仕組みを作る前に**実際に人がその操作をできるか**を1回試す。AIがマスター名義でPRを作る運用では formal Approve は
  使えない＝tier-2の合格条件は「作者本人が実行可能な操作」（Merge/コメント/ラベル）で設計する。物理強制は AI を縛り、マスターは Bypass で通す。

## 2026-07-24 承認の階層(tier-1/tier-2＝basis-gate)そのものが過剰＝マスターの使い勝手を破壊していた。廃止して普通のPRフローへ
- 事象：basis-gate による承認3層（変更のたびに「許可が要るか」を判定して止める検問所）を導入して以降、マスターが承認待ちに追われ、
  2日間を消耗。自己承認不可・自作auto-merge空振り・branch protection 手動必須…と副次問題が連鎖し、非エンジニアのマスターには
  理解も運用も不能な複雑さに。マスターの明確な指示により **basis-gate(tier-1/tier-2)を全廃**し、「AIがPRを出す→誰でもレビュー/承認→マージ」
  の一般的なフローへ戻すことを決定。
- 根因：ソロ/少人数・非エンジニアのオーナーという実態に対し、大企業級の多層承認ガバナンスを自作で被せた＝**要件に対して過剰設計**。
  「本人採点の禁止」を突き詰めるあまり、日常の全変更に承認判定を挟み、CI(普通の自動テスト)だけで足りる所を検問所で二重化した。
- 対処：basis-gate 一式（`.github/workflows/basis-gate.yml`／`.github/scripts/basis-gate.sh`／`roadmap-basis-changed.mjs`／
  `basis-reviewers.txt`／`bot-reviewers.txt`／`.coderabbit.yaml`／`docs/basis-gate.md`）を削除、AGENTS.md の「承認は3層」を撤去。
  チェックイン/アウト(handoff)・CI・roadmap-required・evidence 検査は温存。main の branch protection から必須チェック `basis-gate` を
  外すのはマスターの画面操作（ツール不可）。
- 教訓：**ガバナンスは組織規模と運用者のリテラシーに合わせる**。ソロ/非エンジニアには「PR＋CI緑＋誰でも承認→マージ」で十分。
  仕組みが目的化して使い勝手を殺したら、それ自体が最大の失敗。足す前に「この人がこれを毎日回せるか」を問う。

## 2026-07-24 検査スクリプト追記で JS 文字列を壊しかけた（コミット前に検知）
- 事象：`scripts/verify-roadmap-evidence.mjs` に日本語のエラーメッセージを追記した際、二重引用符 `"..."` の
  文字列内に生の `"ツリー"` を入れてしまい、JS 文字列が途中で閉じてパースエラーになる寸前だった。
- 根因：日本語文中の強調に半角ダブルクォートを使い、外側のリテラルと衝突させた。
- 対処：`『ツリー』` に置換。**コミット前に `node scripts/verify-roadmap-evidence.mjs` をローカル実行**して緑を確認してから push。
- 教訓：**文字列リテラル内の強調は全角『』か鉤括弧を使う**（半角クォートを本文に混ぜない）。スクリプト変更は必ず
  ローカル実行で構文まで通してからコミットする（型/lint/実行のどれかで機械に踏ませる）。

## 2026-07-24 setup.sh の owner/repo 判別を dry-run で修正（先頭2要素→末尾2要素）
- 事象：`scripts/setup.sh` で origin URL からリポジトリを判別する際、パスの「先頭2要素」を owner/repo と
  していたため、プロキシ経由の origin（`http://host/git/OWNER/REPO`）で owner=`git` と誤判定した。
- 根因：GitHub の owner/repo は常にパスの「末尾2要素」なのに、前置きパスの可能性を無視した。
- 対処：末尾2要素（`repo=${path##*/}` / `owner=$(dirname)`相当）を取る方式へ変更。`--dry-run` を先に実行して
  判別結果とペイロードを目視確認してから適用する運用にした。
- 教訓：**外部から与えられる URL は前置き・末尾の揺れを想定して末尾から取る**。破壊的操作（branch protection の
  PUT 等）は必ず `--dry-run` を実装し、対象を目視確認してから本実行する。

## 2026-07-24 「ブラウザ1クリックで branch protection」ボタンが原理的に不可能だった（実リポジトリで露見）
- 事象：新リポジトリの Actions で1クリック実行する `.github/workflows/setup.yml` を追加したが、実際に
  コピーした menu-saas で startup failure（赤×・-1s）。ワークフロー名も出ずファイルパス表示になった。
- 根因：(1) `permissions: administration: write` は GITHUB_TOKEN の有効スコープに存在せず、ワークフローが
  不正で起動失敗。(2) そもそも GitHub Actions の自動トークン(GITHUB_TOKEN)には branch protection を変更する
  権限が無い＝この方式は根本的に成立しない。ローカルの YAML parse は通るため机上では気づけず、実適用を
  検証しないまま「1クリックで済む」と説明してしまった。
- 対処：setup.yml を撤去。branch protection は「管理者本人のブラウザ操作(Settings→Branches、道具不要)」を
  正の手順にし、`bash scripts/setup.sh` は gh 認証済みエンジニア向けの代替に降格。AGENTS.md 手順0/_TEMPLATE.md/
  setup.sh コメントを是正。
- 教訓：**「サーバー側の権限が要る操作」を自動トークンで賄えると仮定しない**。権限モデル(誰のトークンに何が
  できるか)を先に確認する。**外部に出す前に必ず実環境で1回実行して赤/緑を見る**（机上の parse 成功を根拠に
  「動く」と言わない）。非エンジニア向けは「その人が実際にクリックだけで完了できるか」を実物で確かめる。

## 2026-07-26 A-1（サインアップ）検証1回目、ローカルDBにマイグレーション未適用でFAIL
- 事象：`rahiseko-alt/Web-platform-v2`でA-1（新規アカウント作成）の独立検証1回目、
  `POST /api/auth/sign-up/email`がHTTP 500。サーバーログに`relation "users" does not exist`
  （PostgreSQLエラーコード42P01）。
- 根因：ローカル開発サーバー（PGlite組み込みDB、`apps/web/.pglite`）を起動する際、drizzleの
  スキーマ（`drizzle/0000〜0002_*.sql`）を一度も適用していなかった。`pnpm dev`はDBスキーマを
  自動では作らない（`pnpm db:push`が別途必要）。
- 対処：`pnpm db:push`でスキーマを適用し、サーバーを再起動してから再検証しPASS（独立検証者が
  プロセス再起動・別プロセスからの直接SQLクエリで永続化まで確認）。
- 教訓：**ローカル/CIで新規に立てたDB（PGlite等の組み込みDBを含む）に対して原子ロードマップの葉を
  検証する前は、必ず`pnpm db:push`（または相当のマイグレーション適用）でスキーマが最新であることを
  先に確認する。** 「コードが実装済み」と「実行環境で実際に動く状態になっている」は別事実であり、
  後者を確認せずに前者だけで verify を進めない。

## 2026-07-27 設計根拠の文書がコードだけ移送されて失われ、23ファイルが実在しない参照を持っていた
- 事象：マスター指摘「スパゲッティコードになっていないか」の調査で、`apps/web` の23ファイルが
  `docs/ai-agent-dev-method.md`（§3/§5/§6/§7を名指し）・`docs/architecture-decision-0.md`・
  `security-runtime.md`・`api-validation.md`・`wireframe.md`・`design-system.md`・`design/concept.md`・
  `memory.md`・`plan stateful-painting-pebble.md` を「準拠元＝正」として引用しているのに、
  いずれも本リポジトリに存在しないことが判明。git 全履歴を探しても一度も存在しなかった。
  機械リンタを書いて数え直したところ、grep の目視では23件だったが実際は**29件**あった。
- 根因：前リポジトリからコードだけを移送し、根拠文書を持ってこなかった。コメント中の参照は
  型チェックにもテストにも掛からないため、壊れていても誰も気づかない。人手のレビューでは
  「それらしい文書名」が書いてあるだけで通ってしまう。
- 対処：原文は復元不能なので推測で書き起こさず、`docs/design-notes.md`（現行コードから検証できる
  事実だけの索引。失われた事実自体も明記）を新設して参照を張り替えた。再発防止に
  `scripts/verify-doc-refs.mjs` を追加し CI へ組み込み、故意にリンクを壊すと赤になることも確認した。
- 教訓：**コードを別リポジトリへ移すときは、そのコードが参照している文書も一緒に移す。**
  参照の生死は型・テストの検査対象外なので、機械で検査する仕組みを最初から置く。
  また、**目視の grep で件数を数えて報告しない**（29件を23件と誤って数えた）。数は機械に数えさせる。

## 2026-07-27 ルート削除後、ローカルの typecheck が .next の生成物だけを理由に落ちた
- 事象：`apps/web/app/preview-proto/` を削除した直後の `pnpm -r typecheck` が exit 2 で失敗。
  ソースは正しいのに、削除済みページを import する型定義が残っていた。
- 根因：Next.js が生成する `apps/web/.next/types/**` は前回ビルド時点のルート構成を反映しており、
  ルートを消してもビルドし直すまで古いままになる。tsconfig の対象に入るため typecheck が拾う。
- 対処：`pnpm -r build` を先に回して型定義を再生成したところ typecheck は緑。CI は毎回クリーン
  チェックアウトなので同じ失敗は起きない（ローカル固有の現象）。
- 教訓：**ルート（ページ/APIルート）を追加・削除した直後にローカルで typecheck が落ちたら、
  まず `pnpm -r build` で `.next/types` を再生成してから判断する。** 生成物由来の失敗を
  「コードが壊れている」と誤読して不要な修正を入れない。

## 2026-07-27 信頼オリジン未設定で、本番ドメインからのログインが403になる地雷を発見（A-2検証の副産物）
- 事象：A-2（ログイン）の独立検証中、`http://localhost:3000` 以外のオリジンからの
  `POST /api/auth/sign-in/email` が **403** になることを実測。Origin=localhost→200 /
  Origin=127.0.0.1→403（Host も 127.0.0.1 の同一オリジンでも403）/ Origin=evil.example.com→403。
  サーバーログは `ERROR [Better Auth]: Invalid origin: http://127.0.0.1:3000`。
- 根因：`apps/web/src/auth/index.ts` に `baseURL` / `trustedOrigins` の指定が無く、`BETTER_AUTH_URL`
  も `.env.example` に無い。Better Auth は未設定時にリクエスト由来でオリジンを決めるため、信頼
  オリジンが実質 `localhost:3000` に固定される（起動時に `Base URL is not set` の警告も出ている）。
- 発見が遅れやすい理由：**画面表示は「メールアドレスまたはパスワードが正しくありません」になる。**
  これは意図的なエラー隠蔽（docs/design-notes.md §4-1）の副作用で、403（オリジン拒否）と
  401（資格情報誤り）が利用者からは区別できない。ローカルでは localhost で触るため一生再現しない。
- 対処：本葉（A-2）の criteria 範囲外のため、この時点では実装を変えず、E-2 の detail と本ログへ
  記録した（ツリーに載せずに直す＝AGENTS.md の順序違反を避けるため）。本番接続（E）に着手する
  ときに、まず `trustedOrigins`/`BETTER_AUTH_URL` を本番ドメインで設定してから一連を試すこと。
- 教訓：**ローカルでしか触らない設定（信頼オリジン・CORS・Cookieドメイン）は、ローカルで緑でも
  本番で落ちる。** 「ローカルで動いた」を本番の根拠にしない。加えて、**エラーを抽象化して隠す実装は
  運用時の切り分けを潰す**ので、利用者向けメッセージは隠しつつ、サーバーログには真の理由を必ず残す
  （今回はログに `Invalid origin` が出ていたため特定できた）。

## 2026-07-27 devモードでハイドレーション前に送信するとログインフォームが無反応に見えた
- 事象：A-2検証の1回目、ログイン画面のフォーム送信が効かず、URL が `/login?` に変わるだけで
  何も起きない（サーバーには sign-in リクエストが届かない）。
- 根因：React のハイドレーション完了前に submit したため `onSubmit` ハンドラが未装着で、素の
  form GET として送信された。dev モードはハイドレーションが遅く再現しやすい。
- 対処：ページ読み込み完了を待ってから操作し直したところ正常に動作（A-2 は最終的に PASS）。
- 教訓：**ローカルの画面操作で「無反応」に見えたら、まず実装の不具合と決めつけずハイドレーション
  完了を待って再試行する。** サーバーログにリクエストが届いているかで、クライアント側かサーバー側かを
  切り分けられる。

## 2026-07-28 AIがユーザーにAPIキーの平文チャット貼り付けを繰り返し要求した（セキュリティ規律違反）
- 事象：B-1（認証済みフローでのLP生成）の独立検証に実LLM呼び出しが要ると判断し、AI（Claude Code）が
  `OPENAI_API_KEY` の値を**このチャットに直接貼るようユーザーへ繰り返し要求**した。ユーザーの指摘で中止。
  実際の貼り付けは発生しておらず、`apps/web/.env` にキーは入っていない（`SEED_TOKEN=` と
  `PGLITE_DATA_DIR` のみ・gitignore済み）。漏洩は起きていないが、**要求したこと自体が誤り**。
- 根因：AIが「検証に実キーが要る」→「入力経路はチャットしかない」と短絡し、
  **①そもそもキーをこの環境に入れない設計（CIのsecretsで回す）を先に検討しなかった**こと、
  **②チャットを経由しない公式経路（Claude Code on the web の環境変数設定ダイアログ）を
  第一提案にしなかった**こと。制約の中で最善を探さず、危険な手段を既定にした。
- なぜ危険か（一次情報）：
  - 会話履歴はプランにより**最長5年保持**され、学習に使われうる。Claude Code からの利用も含む
    （https://code.claude.com/docs/en/data-usage）。
  - transcript は `~/.claude/projects/` に**平文で**既定30日保存される（同上）。
  - 秘匿値のマスキングは**「既知パターンのみ」**で網羅保証が無い（同上）。
  - セッション共有時に **credential が露出しうる**と公式が明示的に警告している
    （https://code.claude.com/docs/en/claude-code-on-the-web）。
  - OWASP LLM01 原文が「プロンプトインジェクションに確実な防止策があるかは不明」と認めており、
    **一度コンテキストに入った値は間接インジェクション経由で流出しうる**
    （https://genai.owasp.org/llmrisk/llm012025-prompt-injection/）。OWASP LLM02 は
    security credentials の漏出をリスクとして扱う。
  - Anthropic公式：「Store API keys in a secrets manager, rotate them periodically, and
    revoke any key you suspect has leaked」（https://platform.claude.com/docs/en/manage-claude/authentication）。
  - Claude Code on the web には**専用の secrets store が存在しない**と公式に明記されており、
    環境変数はその環境を編集できる人には見える（上記 claude-code-on-the-web）。
- 対処：(1) 要求を撤回。(2) `.claude/settings.json` に公式推奨の deny ルール
  （`Read(./.env)` / `Read(./.env.*)` / `Read(./secrets/**)`）を追加し、AIが`.env`を読めない状態にした。
  (3) 実キーが要る検証は**CI（GitHub Actions secrets）で回し、evidence を CI run URL にする**方針へ変更。
- 教訓：**AIはシークレットの値そのものを要求・保持・出力しない。** 「入力経路がチャットしかないから」は
  平文要求の理由にならない。実キーが要る検証に突き当たったら、順に
  **①キー不要の設計で成立しないか → ②CIのsecretsへ置いて外部事実(CI run URL)を証拠にできないか
  → ③チャットを経由しない公式経路（環境変数設定ダイアログ）** を検討し、それでも駄目なら
  使い捨て・短命・低予算の専用キーに限定する。**この順序を飛ばさない。**
  なお本リポジトリの `AGENTS.md`「evidence は偽造不能な外部事実のみ（CI run URL / commit SHA）」は、
  ②を選べば**セキュリティと検証規律を同時に満たす**ことを意味する。困ったら②が既定解。

## 2026-07-28 基準の第2の目（basis-reviewer）の帰りを待たずに実装へ着手した

- 事象：B-2 の原子分解と `criteria`/`verify` を凍結（`docs/roadmap.html` を編集）した直後、
  独立レビュー（`.claude/agents/basis-reviewer.md`）を**バックグラウンドで走らせたまま実装に着手**した。
  レビューは objection（反証7件）で返り、うち原子性1件・十分性4件は criteria の書き直しが必要な内容だった。
  結果として、レビューは「基準を凍結する門」ではなく「出来た実装の事後確認」になっていた。
  レビュー自身にも「基準が既存コードをなぞった線に見える」と指摘された（実際の順序は criteria が先だが、
  レビュー時点の作業ツリーには実装が存在したため、**外形上は区別がつかない**）。
- 根因：`AGENTS.md` の「基準は着手前に固定」を**自分が criteria を書いた時点で満たした**と解釈し、
  「第2の目が基準を承認するまでが凍結」という門の意味を落とした。並行実行で時間を節約しようとして、
  門を門でなくした。
- 実害（幸い今回は検出できた）：レビュー指摘④は**実装の実バグ**だった。生成キャッシュ（`src/generate/cache.ts`）が
  依頼文だけをキーにしたプロセス共有の Map で利用者ごとに分かれておらず、入口は `fromCache:false` の
  ときだけ保存する実装だったため、**別の人が同じ言い回しで依頼すると、画面にはLPが出るのに
  その人の持ち物としては1件も残らない**状態になっていた。criteria が緩いままなら受入検証も素通りしていた。
- 対処：(1) レビュー指摘に沿って criteria/verify を書き直し（旧 B-2-b を B-2-b-1／B-2-b-2 へ分割、
  対照実験・同一性照合・上書き検出・実行可能な読み出し手段を verify へ明記）、実装をそれに追従させた。
  (2) キャッシュキーに所有者スコープを畳み込み、回帰テストを追加した。
- 教訓：**基準の凍結は「第2の目が返ってくるまで」完了していない。** 独立レビューを走らせたら、
  その結果を受けて criteria を確定させてから実装に入る。並行実行してよいのは、基準に依存しない調査
  （既存コードの読解・現状把握）までで、**成果物の作成を並行させない**。
  レビューを待つ時間は、基準が緩いまま実装と受入検証の両方を作り直す時間より短い。

## 2026-07-28 空の一覧要素を toBeVisible で待って B-2 受入CIが落ちた
- 事象：B-2 受入ワークフロー（b2-persist-smoke.yml）の初回runが失敗。
  `expect(locator('[data-site-list="site-list"]')).toBeVisible()` が `Received: hidden` で落ちた。
  ログには `14 × locator resolved to <ul data-site-count="0" ...></ul>` と出ており、
  **要素はDOMに在るのに hidden 判定**されていた。
- 根因：サイト0件のとき一覧の `<ul>` は子要素が無く**高さ0**になる。Playwright の `toBeVisible()` は
  bounding box が空の要素を「見えない」と扱うため、空リストでは必ず落ちる。
  製品側は正しく描画できており、**テストのアサーションの選び方が誤っていた**。
  加えて同じ待ち方を `listedSiteIds()` ヘルパーにも書いていたため、利用者Bの一覧（生成前＝0件）を
  読む箇所でも同じ理由で落ちる状態だった（1箇所直しても次で落ちる）。
- 対処：判定の意図（「エラー画面ではなく一覧画面に着地した」）を保ったまま、確かめる対象を分けた。
  画面が実際に描画されたことは**可視要素を含む** `data-page="site-list-page"` を新設して `toBeVisible()` で、
  一覧要素そのものは `toBeAttached()` で確かめる。0件であることは従来どおり `data-site-count` で見る。
  ローカルで実測して確認（data-page visible=true / list attached=true / list visible=false / count=0）。
- 教訓：**「存在するか」を確かめたいときに `toBeVisible()` を使わない。** 可視性は
  「中身があるか」に依存するので、空になりうるコンテナ（一覧・テーブル・ログ領域）では
  `toBeAttached()` を使う。「画面が正しく出たか」を見たいなら、**空でも必ず中身がある要素**
  （見出しを含む領域など）に安定マーカーを置いてそちらで判定する。
  また、待ち方をヘルパーに切り出しているときは、**同じ待ち方をしている全箇所**を一緒に直す
  （1箇所だけ直すと次のrunで同じ理由で落ち、実LLMを使う受入runを無駄に消費する）。

## 2026-07-28 「PGliteは単一プロセス専有だから読めたこと自体が停止の証拠」は事実誤認だった
- 事象：B-2-a（保存の永続化）の検証で、AIが「PGlite は単一プロセス専有なので稼働中サーバーと同時に
  横から読むことはできない。逆に言えば**読めたこと自体が**サーバーが落ちてもデータが残っている証拠になる」
  と書き、この不変条件を検証スクリプト・E2E・ワークフロー・roadmap の計4箇所に根拠として記録していた。
  独立検証者が pglite 0.5.4 で実測したところ、**書き込みプロセスが生きたまま別プロセスから同じ dataDir を
  開いて読めた**（`CONCURRENT OPEN OK, sites=1`）。前提が偽だった。
- 根因：`docs/verification/A-4-idor-reject.md` の観測（独立プロセスからの書き込みが稼働中サーバーへ即時
  反映されなかった）を「同時に開けない」と**拡大解釈**した。実際に観測したのは「反映されない」であって
  「開けない」ではない。**観測していない性質を、観測した事実から演繹したつもりになっていた。**
- 影響：B-2-a の結論自体は変わらない（実際の停止はワークフローのステップ分離と Playwright の webServer
  終了で担保されており、読み出しはディスク上のファイル由来）。ただしこの誤った根拠を放置すると、
  将来「読めたから停止していた」と誤って evidence を組み立てる事故が起きる。
- 対処：4箇所の記述を「停止はステップ分離＋webServer終了で担保する」へ訂正し、さらにワークフローへ
  **積極的な停止確認**（検証の直前に curl して応答があれば落とす）を追加した。
- 教訓：**「〜できないはず」を根拠にしない。** 不変条件を証拠の土台に据えるなら、その不変条件自体を
  実測で確かめる。特に「Xは起きないから、Yが起きたことはZの証明になる」という形の推論は、Xの検証を
  飛ばすと土台ごと崩れる。**停止・排他・到達不能といった「起きないこと」は、起きないことを確かめるのではなく、
  こちらから能動的に確認する手段（到達性チェック等）を置く。**

## 2026-07-28 空文字は includes() を常に通るため、同一性の照合が素通りしていた
- 事象：B-2-a の検証スクリプトが「画面に出た見出しが保存先の文言に含まれるか」を
  `storedTexts.includes(site.headline)` で見ていたが、`site.headline` が空文字だと
  `''.includes('')` は常に true になり**無条件で緑**になっていた。独立検証者が実測（exit=0）で確認。
  歯止めは E2E 側の `expect(headline.length).toBeGreaterThan(0)` だけで、そこを緩めると静かに穴が開く状態だった。
- あわせて：criteria は「**全セクションの文言**が残る」ことを要求しているのに、verify は
  section_type の並びと**見出し1本**しか照合しておらず、各セクションの文言を空で保存する実装でも緑になった。
- 対処：検証スクリプト側に (a) 観測した見出しが空でないこと (b) 文言が1つも無いセクションが存在しないこと、
  の2つのガードを追加。最小データを仕込んで**赤→緑を往復させて実測確認**した
  （正常=exit0 / 見出し空=exit1 / 見出し別物=exit1 / 空セクション=exit1）。
- 教訓：**部分一致（includes / startsWith / 正規表現）で同一性を見るときは、空・極端に短い入力を先に弾く。**
  空文字は多くの部分一致で恒真になる。加えて、**criteria の文言と verify が実際に見ているものを突き合わせる**。
  「全セクション」と書いたなら全セクションを見る。1本だけ見て「代表として十分」と判断するのは、
  基準を自分に都合よく緩めているのと同じ。

## 2026-07-30 OPENAI_API_KEY が無効化し、実LLMの受入ワークフロー4本が同時に赤になった
- 事象：C-1 の実装を push したところ、**実LLMを叩く受入ワークフロー4本（B-1 / B-2 / B-3 / C-1）が全て赤**に
  なった。原因は共通で、OpenAI が **HTTP 401 `invalid_api_key`**（"Incorrect API key provided: sk-proj-…CQMA"）を
  返している。リポジトリ Secrets の `OPENAI_API_KEY` が失効・無効化したものと判断した。
- 切り分け：**今回の変更（`app/generate/page.tsx` の言い直し経路追加）による退行ではない**。今回1行も
  触っていない `tests/e2e/authed-persist.spec.ts`（B-2）でも同一の 401 が出ており、`ci-green`（型/Lint/
  テスト158件/ビルド/audit/roadmap・doc-refs検査/起動スモーク）は緑。
- 影響：**C-1 / C-1-b の evidence が取得できない**。受入は「実際に生成が走ること」を前提にしているので、
  鍵が無効な run は証拠にならない（`evidence` は空のまま＝未充足として残す）。既存の B-1/B-2/B-3 の
  evidence は鍵が生きていた当時の run URL なので有効性は失われない。
- 対処：(1) この事象を handoff の②へ記録し、`meta.next` を「鍵の更新 → 受入ワークフローの再実行 →
  C-1/C-1-b の evidence 記入」にした (2) 受入 E2E を、生成失敗の画面（`data-generate-status="error"`）を
  検出したら **180秒待たずにその場で理由つきで落ちる**よう改善した。待ってから落ちると CI ログの結論が
  「要素が見つからない」になり、本当の原因（LLM側の 401）が WebServer ログの奥に埋もれて読めなくなる。
- **鍵はチャットにも作業環境にも平文で置かない**（2026-07-28 の教訓どおり）。更新はマスターが
  Settings → Secrets and variables → Actions で行う。
- 教訓：**外部依存の資格情報が切れると、機械の審判は「赤」になるが「何の赤か」は自明ではない。**
  複数の受入が同時に赤くなったときは、まず「自分の変更が触っていない受入も赤か」を見て共通原因を切り分ける。
  加えて、**受入テストは「前提が崩れた（生成そのものが失敗した）」と「受入条件を満たさなかった」を
  ログ上で区別できる形にしておく**。区別できないと、環境要因の赤を実装の赤と誤診して直しに走る。

## 2026-07-30 葉を分割したのに、その葉を名指ししている他ノードの本文を直し忘れた
- 事象：C-2 の受入基準を作り直す途中、1葉（旧 C-2-e＝『開き直しても・公開URLでも再現される』）が
  2つの受入事実を抱えていたので **C-2-e（自分が開き直す）と C-2-f（公開URLで認証なし）へ分割**した。
  ところが D-1 と E-2 の detail に書いてあった相互参照（『公開URLに出ることは C-2-e が受け持つ』
  『根拠は C-2-d／C-2-e』）を古いまま残した。分割後は公開URLの担当は C-2-f なので、ロードマップ内で
  **同じ事実について2つの異なる記述**が並ぶ状態になった。basis-reviewer が3巡目で検出して差し戻した。
- 根因：分割の作業を「そのノードのJSONを書き換える作業」として閉じてしまい、**そのIDが他所から
  名指しされていること**を確認しなかった。しかも直前（同セッションの1巡目）に受けた最重要 objection が
  まさに『葉の記述と他ノードの前提の不整合』で、その修正のために書いた整合性の文が今回ずれた
  ＝**同型の事故を、それを直した直後に再発させた**。
- 対処：D-1 / E-2 の detail を C-2-f へ差し替え、C-2-e の detail には『自分の作業画面だけを見る』ことを
  明記。4巡目のレビューでファイル全体を検索し、C-2-e を公開URLの担当として指す記述が0件であることを確認した。
- 教訓：**葉を分割・統合・改番したら、そのIDを名指ししている箇所を必ず grep して同じコミットで直す。**
  ノードIDはロードマップ内の相互参照キーなので、分解の形を変える編集は当該ノードだけでは終わらない。
  「整合性のために書いた文」自体が、次の構造変更で最初にずれる箇所になる。
