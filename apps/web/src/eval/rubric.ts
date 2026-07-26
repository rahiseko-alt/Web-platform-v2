/**
 * 評価の配点表（単一正本）。
 *
 * 設計の要点:
 * - **ゲートが既に拒否する項目には配点しない**。`src/generate/validate.ts` が enum・
 *   セクション種別・並び・重複・項目数・プレースホルダを拒否するため、そこへ配点しても
 *   採点は常に満点になり物差しにならない。採点は「ゲートを通った後に残る品質」だけを測る。
 * - 文字数レンジは generate 層（`src/generate/length-rules.ts`）が正本。稼働ループの
 *   差し戻しと採点が**同じレンジ**を見るため、ここでは再輸出するだけで持たない。
 */

export {
  charLength,
  LENGTH_RULES,
  splitRulePath,
  valuesAtPath,
  type LengthRule,
} from '@/generate/length-rules';

/** 機械60点の内訳（マスター承認済 plan: sorted-tinkering-sparrow）*/
export const WEIGHTS = {
  /** A: 依頼文の反映（文脈無視＝金太郎飴の主症状を検知） */
  brief: 15,
  /** B: 文字数レンジ順守 */
  length: 12,
  /** C: 構成の妥当性 */
  structure: 10,
  /** D: 誠実性（捏造・プレースホルダ・年） */
  honesty: 8,
  /** E: 文言の非重複 */
  variety: 5,
} as const;

export type ScoreKey = keyof typeof WEIGHTS;

/** 単票の満点。A〜E の合計 */
export const PER_PAGE_TOTAL = WEIGHTS.brief + WEIGHTS.length + WEIGHTS.structure + WEIGHTS.honesty + WEIGHTS.variety;

/** F: 多様性（セット単位でしか測れないため単票から分離） */
export const DIVERSITY_WEIGHT = 10;

/** 機械側の満点。残り40点は LLM-judge（主観）で、合格線80は両者の合算で判定する */
export const MACHINE_TOTAL = PER_PAGE_TOTAL + DIVERSITY_WEIGHT;

/** セクション数の許容枠（構成の妥当性 C で使う） */
export const SECTION_COUNT_RANGE = { min: 5, max: 9 } as const;

/**
 * 主観40点の内訳（LLM-judge・plan: parallel-hopping-island）。
 * ai-agent-dev-method.md §6 の3軸（デザインの主観品質・トーン一致・金太郎飴判定）に対応する。
 * 人間較正は未実施のため、このスコアは常に「参考値」として扱う（judge単独運用しない）。
 */
export const JUDGE_WEIGHTS = {
  /** G: トーン・文脈適合（依頼文の業種・空気感とコピー/デザイントークンが合っているか） */
  tone: 15,
  /** H: コピーの主観品質（自然さ・具体性・説得力。単票内の紋切り型を検知） */
  copyQuality: 15,
  /** I: 総合的な完成度（"80点の販売可能クオリティ"に沿っているかの総合判断） */
  overall: 10,
} as const;

export type JudgeKey = keyof typeof JUDGE_WEIGHTS;

/** 主観側の満点 */
export const JUDGE_TOTAL = JUDGE_WEIGHTS.tone + JUDGE_WEIGHTS.copyQuality + JUDGE_WEIGHTS.overall;

/** 機械60点＋主観40点の満点 */
export const GRAND_TOTAL = MACHINE_TOTAL + JUDGE_TOTAL;

/** 合格線（daigi の "80点の販売可能クオリティ" 基準） */
export const PASS_LINE = 80;
