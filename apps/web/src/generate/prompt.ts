/**
 * プロンプト設計（plan A3）。
 *
 * 5項目（目的 / 入力情報 / 判断基準 / 出力形式 / 不明時の処理）を全部書く。
 * 技法は初回は最小限（役割付与・構造縛り・制約明示）だけ。few-shot の例示は入れない
 * ——既存の組合せに引きずられて多様性を殺す疑いがあり、入れるかは計測後に判断する
 * （docs/design-notes.md §6-3・plan A3「技法の適用方針」）。
 *
 * コンテクストの扱い: 現時点では台帳を全量埋め込む。「指示があれば絞る／無ければ全部」
 * のうち後者に当たる（2026-07-20 マスター確定のパイプ設計）。絞り込みは計測で
 * 過剰と分かってから入れる。
 */

import { schemaFor, sectionContentSchemas } from './section-schemas';
import { describeSchema } from './describe';
import { OUTPUT_SKELETON, WRITING_METHOD } from './prompt-writing';
import type { Rejection } from './types';
import {
  ALIGNS,
  BUTTON_SHAPES,
  CARD_STYLES,
  HERO_VARIANTS,
  MOTIONS,
  PALETTES,
  RHYTHMS,
  SECTION_TYPES,
  SECTION_VARIANTS,
  THEMES,
  variantsFor,
} from './vocabulary';

function designVocabularyBlock(): string {
  const variantLines = Object.keys(SECTION_VARIANTS)
    .map((key) => `  - ${key}: ${variantsFor(key).join(' | ')}（先頭が既定）`)
    .join('\n');

  return [
    `- heroVariant: ${HERO_VARIANTS.join(' | ')}`,
    `- rhythm: ${RHYTHMS.join(' | ')}`,
    `- align: ${ALIGNS.join(' | ')}`,
    `- theme（書体・余白・角丸の性格）: ${THEMES.join(' | ')}`,
    `- palette（色。theme とは独立に選ぶ。theme-default はテーマ既定色のまま）: ${PALETTES.join(' | ')}`,
    `- motion（ホバー・スクロール連動の強度）: ${MOTIONS.join(' | ')}`,
    `- cardStyle（カードの角丸・余白・色調プリセット）: ${CARD_STYLES.join(' | ')}`,
    `- buttonShape（ボタンの形状）: ${BUTTON_SHAPES.join(' | ')}`,
    '- sectionVariants（骨格を切替えられるセクションのみ。他は指定しない）:',
    variantLines,
  ].join('\n');
}

function sectionCatalogBlock(): string {
  return SECTION_TYPES.map((sectionType) => {
    const schema = schemaFor(sectionType);
    const body = schema ? describeSchema(schema) : '  （契約未定義）';
    return `### ${sectionType}\n${body}`;
  }).join('\n\n');
}

const ROLE = `あなたは業種ごとの商習慣と表現に精通したWebデザイン設計者です。
完成したデザインやHTMLは作りません。作るのは「要素の値」だけです。組み立ては機械が行います。`;

const CRITERIA = `- **業種と表現をセットで解釈する。** 「老舗和菓子店の落ち着き」と「ネイルサロンの落ち着き」を同じ値にしない。「落ち着き」だけを切り出して判断しない
- **台帳にある値だけを使う。** 台帳に無い値を作らない。近い値へ勝手に寄せない
- **事実を作らない。** 依頼文に無い実績・受賞歴・創業年・資格・店舗数・在籍人数・リピート率を書かない。数値は依頼文に根拠があるものだけ
- **依頼文で名指しされた訴求を落とさない。** 例「料金メニューと予約をしっかり見せたい」なら、料金が読めるセクションと予約への導線を必ず構成に入れる
- **文字数の指定は必ず守る。下限を下回らない。** 契約に「40〜70字」等と書かれた項目は、**数えて**その範囲に収める。1文で言い切って終わらせない（実測で全項目が下限割れしていた＝最も多い失敗）。範囲に届かない時は、依頼文から読み取れる具体（誰向けか・どんな時に使うか・何が違うか）を足して埋める。**依頼文に無い事実を作って埋めるのは禁止**——足すのは表現であって事実ではない
- セクションは必要なものだけ選ぶ。根拠の無いセクション（実績数値が無いのに stats-01 等）は採用しない
- 並び順は配列の順序がそのまま描画順になる。header-01 を先頭、footer-01 を末尾にする`;

const UNKNOWN_HANDLING = `- 依頼文から根拠が読み取れない項目は**推測で埋めない**。何が不足しているかを unknowns に日本語で列挙し、needs_review を true にする
- 台帳のどの値も当てはまらないと判断した場合も、近い値へ寄せずに unknowns へ出す
- 電話番号・メールアドレス・住所は、依頼文に無ければ創作しない（unknowns に出す）
- **"unknown" / "未定" / "不明" / "TBD" / "-" のようなプレースホルダを本文に書かない。** これらは本文としてそのまま画面に出てしまう。値が無い項目は**キーごと省略**し、unknowns に日本語で書く（省略できる項目は契約に「任意」と示してある）
- **画像は機械が用意するので、画像URLは出力しない**（契約にも含めていない）`;

/** LLM へ渡す指示文（依頼文は含まない）。台帳から動的に生成する */
export function buildSystemPrompt(): string {
  return `${ROLE}

## 目的

依頼文で示された店舗・事業について、LP を構成する**要素の値**を決めてください。

## 入力情報

- 依頼文（原文のまま渡されます）
- 機械語彙の台帳（下記。ここに列挙された値以外は使えません）
- セクションごとの content 契約（下記。項目数の枠は機械が決めています）

## 機械語彙の台帳

${designVocabularyBlock()}

## セクションごとの content 契約

${sectionCatalogBlock()}

## 判断基準

${CRITERIA}

## 本文の作り方

${WRITING_METHOD}

## 出力形式

JSON のみを返してください。前後に説明文・コードフェンスを付けないでください。

${OUTPUT_SKELETON}

## 不明時の処理

${UNKNOWN_HANDLING}`;
}

/** 依頼文は分解せず原文のまま渡す（文脈を壊さないため） */
export function buildUserPrompt(brief: string): string {
  return `## 依頼文\n\n${brief}`;
}

/**
 * 機械制御ゲートが拒否した時の差し戻し文面（plan A4・B9 のループ）。
 * 何が範囲外だったかを明示する。既定値で黙って埋めさせない。
 */
export function buildRetryPrompt(rejections: Rejection[]): string {
  const list = rejections.map((r) => `- ${r.path}: ${r.reason}`).join('\n');
  return `前回の出力は機械検証で拒否されました。以下の箇所を直して、JSON 全体をもう一度出力してください。

${list}

台帳に無い値を使わないでください。値を決められない場合は推測で埋めず unknowns に出して needs_review を true にしてください。`;
}

export const sectionTypesWithContract = Object.keys(sectionContentSchemas);
