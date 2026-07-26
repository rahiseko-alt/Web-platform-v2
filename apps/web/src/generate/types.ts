/**
 * NL→要素 変換レイヤーの入出力型。
 *
 * 既存の DesignSpec / RenderableSection をそのまま再利用し、新しい描画用の型を作らない
 * （plan A2）。LLM が返すのは「要素の値」だけで、id・order・描画は機械が付ける。
 */

import { z } from 'zod';
import type { DesignSpec } from '@/templates/types';
import type { RenderableSection } from '@/db/queries/site-render';
import { ALIGNS, BUTTON_SHAPES, CARD_STYLES, HERO_VARIANTS, MOTIONS, PALETTES, RHYTHMS, SECTION_TYPES, THEMES } from './vocabulary';

/** 入力は依頼文1本のみ。フォーム項目に分解しない＝文脈を壊さないため（plan A2） */
export interface GenerateInput {
  brief: string;
}

/** LLM が返す生の形。ここでは形だけを縛り、値の妥当性は validate.ts が見る */
export const llmOutputSchema = z.object({
  design: z.object({
    heroVariant: z.enum(HERO_VARIANTS),
    rhythm: z.enum(RHYTHMS),
    align: z.enum(ALIGNS),
    sectionVariants: z.record(z.string(), z.string()).default({}),
    cardStyle: z.enum(CARD_STYLES).default('flat'),
    buttonShape: z.enum(BUTTON_SHAPES).default('rounded'),
  }),
  theme: z.enum(THEMES),
  palette: z.enum(PALETTES),
  motion: z.enum(MOTIONS),
  /**
   * 本文を書く前の材料（誰に / 何を / 違い）。**下書きなので描画では使わない**
   * （assemblePage は読まない）。sections より前に置かせることで、先に考えた材料が
   * 後続の本文生成を条件付ける＝1回の呼び出しで思考させる（prompt-writing.ts）。
   * 形は縛らない（縛ると下書きの形違いで差し戻しが増えて本題が進まない）。
   */
  writing_notes: z.record(z.string(), z.unknown()).optional(),
  sections: z
    .array(
      z.object({
        sectionType: z.enum(SECTION_TYPES),
        content: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  needs_review: z.boolean(),
  unknowns: z.array(z.string()),
});

export type LlmOutput = z.infer<typeof llmOutputSchema>;

/** 機械が組み立てた最終形。これを既存レンダラへそのまま渡す */
export interface GeneratedPage {
  design: DesignSpec;
  theme: string;
  /** 配色軸。theme とは独立に色だけを決める */
  palette: string;
  /** 動き軸。ホバー・スクロール連動の強度 */
  motion: string;
  sections: RenderableSection[];
  needsReview: boolean;
  unknowns: string[];
}

/** 機械制御ゲートの判定結果。拒否理由は LLM へ差し戻す文面として使う */
export type ValidationResult =
  | { ok: true; value: LlmOutput }
  | { ok: false; rejections: Rejection[] };

export interface Rejection {
  /** どこが問題か。例: sections[2].content.items */
  path: string;
  /** 何が起きたか（LLM に差し戻す時にそのまま読ませる） */
  reason: string;
}
