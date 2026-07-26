/**
 * セット採点（機械10点・F: 多様性）。
 *
 * 金太郎飴（似たLPの量産）は**1本を見ても分からない**。複数の依頼文に対する結果を
 * 並べて初めて「軸の値が振れているか」が測れるため、単票採点から分離してある。
 *
 * 判定は「掛け算の軸ごとに何種類の値が実現したか」。全件同値なら 0 点、
 * 取りうる値（台帳）を件数の範囲で出し切れば満点。
 */

import type { GeneratedPage } from '@/generate/types';
import { BUTTON_SHAPES, CARD_STYLES, HERO_VARIANTS, MOTIONS, PALETTES, SECTION_VARIANTS, THEMES } from '@/generate/vocabulary';
import { DIVERSITY_WEIGHT } from './rubric';

export interface AxisDiversity {
  axis: string;
  /** 実現した値の種類数 */
  distinct: number;
  /** この件数で到達しうる上限（= min(台帳の値数, 件数)） */
  cap: number;
  /** 0〜1 */
  fraction: number;
}

export interface DiversityScore {
  /** 2件未満は測定不能（1本では多様性を語れない） */
  measurable: boolean;
  score: number;
  max: number;
  axes: AxisDiversity[];
  notes: string[];
}

/** sectionVariants は「未指定」も1つの状態なので、各セクションの取りうる値 + 1 の積 */
const VARIANT_COMBINATIONS = Object.values(SECTION_VARIANTS).reduce((product, values) => product * (values.length + 1), 1);

function axisOf(axis: string, values: string[], possible: number): AxisDiversity {
  const distinct = new Set(values).size;
  const cap = Math.min(possible, values.length);
  const fraction = cap <= 1 ? 1 : (distinct - 1) / (cap - 1);
  return { axis, distinct, cap, fraction: Math.round(fraction * 100) / 100 };
}

/** 複数ページの結果セットから多様性を採点する */
export function scoreDiversity(pages: GeneratedPage[]): DiversityScore {
  if (pages.length < 2) {
    return {
      measurable: false,
      score: 0,
      max: DIVERSITY_WEIGHT,
      axes: [],
      notes: ['2件以上ないと多様性は測れません（1本では金太郎飴か判定不能）'],
    };
  }

  const axes: AxisDiversity[] = [
    axisOf('theme', pages.map((page) => page.theme), THEMES.length),
    axisOf('palette', pages.map((page) => page.palette), PALETTES.length),
    axisOf('motion', pages.map((page) => page.motion), MOTIONS.length),
    axisOf('heroVariant', pages.map((page) => page.design.heroVariant), HERO_VARIANTS.length),
    axisOf('cardStyle', pages.map((page) => page.design.cardStyle ?? 'flat'), CARD_STYLES.length),
    axisOf('buttonShape', pages.map((page) => page.design.buttonShape ?? 'rounded'), BUTTON_SHAPES.length),
    axisOf('sectionVariants', pages.map((page) => JSON.stringify(page.design.sectionVariants ?? {})), VARIANT_COMBINATIONS),
    axisOf('セクション構成', pages.map((page) => page.sections.map((section) => section.sectionType).join('>')), pages.length),
  ];

  const mean = axes.reduce((sum, axis) => sum + axis.fraction, 0) / axes.length;
  const flat = axes.filter((axis) => axis.distinct === 1).map((axis) => axis.axis);

  const notes = [`${pages.length} 件で採点`];
  if (flat.length > 0) notes.push(`全件同値の軸: ${flat.join(' / ')}`);

  return {
    measurable: true,
    score: Math.round(DIVERSITY_WEIGHT * mean * 10) / 10,
    max: DIVERSITY_WEIGHT,
    axes,
    notes,
  };
}
