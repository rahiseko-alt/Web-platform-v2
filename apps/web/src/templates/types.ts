/**
 * テンプレート構造（docs/design-notes.md §2 準拠）。
 * HTML複製ではなくJSON設定データ + コンポーネントレジストリで生成する。
 */

export interface PageComposition {
  slug: string;
  sections: string[];
}

/**
 * 構造化デザイントークン（金太郎飴脱却の機械制御面）。
 * 設計思想: 「自由文で design を選ぶ/評価する/修正する」とモデルのデフォルト挙動＝
 * 最頻値（無難＝金太郎飴）に平均化される。そこで各選択を**離散トークン**に落とし、
 * 機械（PageRenderer）がトークン→部品変種を決定的に写像する。自由文生成ステップが
 * 無いため平均化しない＝構造的に脱・金太郎飴（品質の良否は別問題・後段のトライ&エラー）。
 */
export type HeroVariant = 'fullbleed-asymmetric' | 'typographic-kinetic' | 'split-editorial';
export type SectionRhythm = 'tight' | 'normal' | 'loose';
export type GridAlign = 'centered' | 'asymmetric';
/** カードの見た目プリセット（角丸・余白・色調を束ねた部品変化軸。size×corner×colorの直積は露出しない） */
export type CardStyle = 'flat' | 'soft' | 'bold';
/** ボタンの形状（角丸 or ピル）。色・強調は既存の Button variant(primary/secondary) が担う直交軸 */
export type ButtonShape = 'rounded' | 'pill';

export interface DesignSpec {
  /** ヒーローの骨格変種（部品側が discrete に切替える） */
  heroVariant: HeroVariant;
  /** セクション間リズム（均一縦積みを崩す） */
  rhythm: SectionRhythm;
  /** グリッドの対称/非対称 */
  align: GridAlign;
  /** 部品ごとの変種指定（sectionType -> 変種id）。未指定は既定変種 */
  sectionVariants?: Record<string, string>;
  /** カードの見た目プリセット。未指定は 'flat'（現行相当） */
  cardStyle?: CardStyle;
  /** ボタンの形状。未指定は 'rounded'（現行相当） */
  buttonShape?: ButtonShape;
}

export interface TemplateDefinition {
  templateId: string;
  category: string;
  theme: string;
  /** 構造化トークン。省略時は既定変種で描画（後方互換） */
  design?: DesignSpec;
  pages: PageComposition[];
}
