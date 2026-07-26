/**
 * 機械語彙の台帳（単一正本）。
 *
 * ここに列挙された値が「LLM に許す選択肢の全部」であり、同時に機械制御ゲート
 * （validate.ts）が照合する基準でもある。プロンプトへはこの台帳から動的に埋め込む
 * ため、台帳・プロンプト・検証の三者が乖離しない。
 *
 * 設計上の要点: 台帳に無い値は LLM に作らせない。これが金太郎飴脱却の関門
 * （docs/ai-agent-dev-method.md §3・LLM は要素の値だけを選び、組み立ては機械が行う）。
 */

import type { ButtonShape, CardStyle, GridAlign, HeroVariant, SectionRhythm } from '@/templates/types';

/** Union に取りこぼしがあればコンパイルエラーにする（台帳 ↔ 実装の双方向照合） */
type AssertExhaustive<Union, Arr extends readonly Union[]> =
  Exclude<Union, Arr[number]> extends never ? true : never;

export const HERO_VARIANTS = [
  'fullbleed-asymmetric',
  'typographic-kinetic',
  'split-editorial',
] as const satisfies readonly HeroVariant[];

export const RHYTHMS = ['tight', 'normal', 'loose'] as const satisfies readonly SectionRhythm[];

export const ALIGNS = ['centered', 'asymmetric'] as const satisfies readonly GridAlign[];

// 実装 union に値が増えた瞬間に typecheck が落ちる（受け入れ基準1）
const _heroExhaustive: AssertExhaustive<HeroVariant, typeof HERO_VARIANTS> = true;
const _rhythmExhaustive: AssertExhaustive<SectionRhythm, typeof RHYTHMS> = true;
const _alignExhaustive: AssertExhaustive<GridAlign, typeof ALIGNS> = true;
void _heroExhaustive;
void _rhythmExhaustive;
void _alignExhaustive;

/** テーマ。src/styles/themes/*.css と 1:1（テストで実ファイル照合する） */
export const THEMES = ['minimal-corporate', 'warm-studio', 'bold-editorial'] as const;

/**
 * 配色軸。テーマ（書体・余白・角丸）とは独立に**色だけ**を差し替える。
 * theme × palette で掛け算の幅が増える（テーマ2 × 配色6 = 12通りの下地）。
 * 実体は src/styles/palettes.css の [data-palette='...']。
 */
export const PALETTES = [
  'theme-default',
  'light-gray',
  'deep-navy',
  'warm-sand',
  'ink-black',
  'fresh-green',
] as const;

/**
 * 動きの強度。ホバー・スクロール連動の演出量を決める。
 * 実体は src/styles/motion.css の [data-motion='...']（scroll-driven animations）。
 */
export const MOTIONS = ['still', 'subtle', 'rich'] as const;

/**
 * 動きの内訳（複数同時に効く）。motion が「強度のプリセット」なのに対し、こちらは
 * **どの演出を使うか**を1つずつ入切りする軸。人が UI で複数選択して微調整する。
 * 実体は src/styles/motion.css の [data-motion-effects~='...']。
 *
 * LLM には選ばせない（契約に含めない）。LLM が選ぶのは motion（強度）だけで、
 * 内訳は下の EFFECTS_BY_MOTION で機械が展開する＝契約を増やさずに調整幅だけ増やす。
 */
export const MOTION_EFFECTS = ['hover', 'reveal', 'stagger', 'parallax'] as const;

/** motion（強度）→ 既定の内訳。人が UI で上書きするまでの初期値 */
export const EFFECTS_BY_MOTION = {
  still: [],
  subtle: ['reveal'],
  rich: ['hover', 'reveal', 'stagger', 'parallax'],
} as const satisfies Record<(typeof MOTIONS)[number], readonly (typeof MOTION_EFFECTS)[number][]>;

/** セクション種別。src/sections/registry.tsx のキーと 1:1（テストで照合する） */
export const SECTION_TYPES = [
  'header-01',
  'hero-01',
  'services-01',
  'features-01',
  'about-01',
  'stats-01',
  'process-01',
  'testimonials-01',
  'faq-01',
  'cta-01',
  'contact-01',
  'footer-01',
] as const;

/**
 * design.sectionVariants で骨格を切替えられるセクションと、その取りうる値。
 * 先頭が既定値（部品側の ?? フォールバックと一致させる）。
 * ここに無いセクションは変種を持たない＝指定させない。
 */
export const SECTION_VARIANTS = {
  'services-01': ['horizontal-rail', 'editorial-index'],
  'cta-01': ['centered', 'split-media'],
  'about-01': ['photo-band', 'split-portrait'],
  'contact-01': ['centered', 'split-panel'],
  'faq-01': ['stacked', 'two-column'],
  'features-01': ['sticky-scroll', 'grid'],
  'footer-01': ['columns', 'centered-stacked'],
  'header-01': ['standard', 'centered-logo'],
  'process-01': ['timeline', 'horizontal-steps'],
  'stats-01': ['row', 'grid'],
} as const satisfies Record<string, readonly string[]>;

/** カードの見た目プリセット。先頭が既定値（Card.tsx の ?? フォールバックと一致させる） */
export const CARD_STYLES = ['flat', 'soft', 'bold'] as const satisfies readonly CardStyle[];

/** ボタンの形状。先頭が既定値（Button.tsx の ?? フォールバックと一致させる） */
export const BUTTON_SHAPES = ['rounded', 'pill'] as const satisfies readonly ButtonShape[];

const _cardStyleExhaustive: AssertExhaustive<CardStyle, typeof CARD_STYLES> = true;
const _buttonShapeExhaustive: AssertExhaustive<ButtonShape, typeof BUTTON_SHAPES> = true;
void _cardStyleExhaustive;
void _buttonShapeExhaustive;

/**
 * content 側の enum（design トークンではなく content フィールドで骨格が変わるもの）。
 * testimonials-01 の mode は sectionVariants ではなく content.mode で切替わる実装のため
 * 台帳上も区別して持つ（実装に合わせる・実装を台帳に合わせて書き換えない）。
 */
export const CONTENT_ENUMS = {
  'hero-01': { anchor: ['bottom-left', 'top-right'] },
  'testimonials-01': { mode: ['quote', 'beforeAfter'] },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type ThemeId = (typeof THEMES)[number];
export type PaletteId = (typeof PALETTES)[number];
export type MotionId = (typeof MOTIONS)[number];
export type MotionEffectId = (typeof MOTION_EFFECTS)[number];
export type SectionTypeId = (typeof SECTION_TYPES)[number];
export type VariantCapableSection = keyof typeof SECTION_VARIANTS;
export type CardStyleId = (typeof CARD_STYLES)[number];
export type ButtonShapeId = (typeof BUTTON_SHAPES)[number];

export function isSectionType(value: string): value is SectionTypeId {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

export function isTheme(value: string): value is ThemeId {
  return (THEMES as readonly string[]).includes(value);
}

/** 指定セクションが取りうる変種。変種を持たないセクションは空配列 */
export function variantsFor(sectionType: string): readonly string[] {
  return (SECTION_VARIANTS as Record<string, readonly string[]>)[sectionType] ?? [];
}
