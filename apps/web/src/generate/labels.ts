/**
 * 台帳値の日本語表示名（UI 専用）。
 *
 * 機械の値（英語 ID）は変えない。**表示だけ**を日本語にする。
 * 台帳（vocabulary.ts）に値が増えたのにラベルを足し忘れると
 * tests/unit/generate-labels.test.ts が落ちる（タグ≠中身の再発防止）。
 */

import {
  ALIGNS,
  BUTTON_SHAPES,
  CARD_STYLES,
  HERO_VARIANTS,
  MOTIONS,
  MOTION_EFFECTS,
  PALETTES,
  RHYTHMS,
  SECTION_VARIANTS,
  THEMES,
} from './vocabulary';

export const AXIS_LABELS_JA = {
  theme: 'テーマ',
  palette: '配色',
  motion: '動きの強さ',
  motionEffects: '動きの内訳（複数選択可）',
  heroVariant: 'ヒーロー',
  rhythm: '余白',
  align: '寄せ',
  cardStyle: 'カードの見た目',
  buttonShape: 'ボタンの形',
  'services-01': 'サービス欄の骨格',
  'cta-01': '訴求欄の骨格',
  'about-01': '会社紹介欄の骨格',
  'contact-01': '問い合わせ欄の骨格',
  'faq-01': 'よくある質問欄の骨格',
  'features-01': '強み欄の骨格',
  'footer-01': 'フッターの骨格',
  'header-01': 'ヘッダーの骨格',
  'process-01': '流れ欄の骨格',
  'stats-01': '実績数値欄の骨格',
} as const;

export const VALUE_LABELS_JA: Record<string, string> = {
  // theme
  'minimal-corporate': '端正・信頼（明朝×深緑）',
  'warm-studio': '温かい・手仕事（サロン系）',
  'bold-editorial': '力強い・現代的（幾何学サンセリフ×鋭角）',

  // palette
  'theme-default': 'テーマ既定',
  'light-gray': 'ライトグレー',
  'deep-navy': 'ディープネイビー',
  'warm-sand': 'ウォームサンド',
  'ink-black': 'インクブラック',
  'fresh-green': 'フレッシュグリーン',

  // motion
  still: '静止（動きなし）',
  subtle: '控えめ（ふわっと出る）',
  rich: '強め（ホバー＋スクロール連動）',

  // motionEffects（動きの内訳・複数選択）
  hover: 'ホバー（触れると浮く・画像が寄る）',
  reveal: 'スクロール連動（入ってきたらふわっと出る）',
  stagger: '順番出し（カードが1枚ずつ遅れて出る）',
  parallax: 'パララックス（画像が背景をゆっくりずれる）',

  // heroVariant
  'fullbleed-asymmetric': '全面写真・非対称',
  'typographic-kinetic': '文字主役・大見出し',
  'split-editorial': '左右分割・雑誌風',

  // rhythm
  tight: '詰める',
  normal: '標準',
  loose: 'ゆったり',

  // align
  centered: '中央寄せ',
  asymmetric: '非対称',

  // cardStyle
  flat: 'フラット（現行）',
  soft: 'ソフト（角丸大・広め）',
  bold: 'ボールド（アクセント色調）',

  // buttonShape
  rounded: '角丸',
  pill: 'ピル（完全な丸角）',

  // sectionVariants
  'horizontal-rail': '横スクロールの帯',
  'editorial-index': '目次のような一覧',
  'split-media': '画像と左右分割',
  'photo-band': '全面写真+重ねカード',
  'split-portrait': '縦長写真と左右分割',
  'split-panel': '左右分割パネル',
  stacked: '縦1列',
  'two-column': '2カラム',
  'sticky-scroll': '左固定+右スクロール',
  grid: 'グリッド',
  columns: '複数カラム',
  'centered-stacked': '中央寄せ縦積み',
  standard: '標準',
  'centered-logo': 'ロゴ中央',
  timeline: '縦タイムライン',
  'horizontal-steps': '横並びステップ',
  row: '横一列',
};

/** 表示名。未登録なら値をそのまま返す（黙って空にしない） */
export function labelJa(value: string): string {
  return VALUE_LABELS_JA[value] ?? value;
}

/** 軸の表示名。未登録なら軸 ID をそのまま返す */
export function axisLabelJa(axis: string): string {
  return (AXIS_LABELS_JA as Record<string, string>)[axis] ?? axis;
}

/** ラベル網羅チェック用（テストが参照する）。台帳の全値を平らに並べる */
export const ALL_VOCABULARY_VALUES: readonly string[] = [
  ...THEMES,
  ...PALETTES,
  ...MOTIONS,
  ...MOTION_EFFECTS,
  ...HERO_VARIANTS,
  ...RHYTHMS,
  ...ALIGNS,
  ...CARD_STYLES,
  ...BUTTON_SHAPES,
  ...Object.values(SECTION_VARIANTS).flat(),
];
