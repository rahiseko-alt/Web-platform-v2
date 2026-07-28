/**
 * 保存済みデータから GeneratedPage を復元する（機械採点の独立再計算・ロードマップ B-3-a 用）。
 *
 * なぜこの関数があるか:
 *   B-3-a の受入は「画面に出た点数」を鵜呑みにせず、**別プロセスから保存先を直接読んで
 *   同じ採点器（scorePage）で再計算し、一致することを確認する」形で判定する。この関数は
 *   その再計算の入力（GeneratedPage）を作る唯一の経路にする（入口ごとに復元手順を持つと、
 *   片方だけ direct と ズレて『たまたま一致』の穴が生まれる）。
 *
 * 欠けを既定値で埋めない：
 *   scoreHonesty（src/eval/score.ts）は unknowns を読む。復元時に unknowns が無い（=null）のを
 *   `[]` で埋めると、表示側も再計算側も「仲良く同じ誤値」で一致してしまい、保存漏れが
 *   検出できなくなる（B-3-a criteria が禁じる偽の緑）。そのため、復元に必要な値が
 *   1つでも欠けていたら例外を投げる。呼び出し側（検証スクリプト）はそれをそのまま
 *   失敗として扱えばよく、握りつぶして既定値へ倒してはいけない。
 */

import { getRenderablePage } from './site-render';
import { GENERATED_PAGE_SLUG } from './save-generated-page';
import type { GeneratedPage } from '@/generate/types';

export interface ReconstructedGeneratedPage {
  brief: string;
  page: GeneratedPage;
}

/** サイトが見つからない（siteId 誤りや削除済み）ときだけ null。データ欠損は例外で表す。 */
export async function getGeneratedPageForScoring(siteId: string): Promise<ReconstructedGeneratedPage | null> {
  const rendered = await getRenderablePage(siteId, GENERATED_PAGE_SLUG);
  if (!rendered) return null;

  const { site } = rendered;
  const missing: string[] = [];
  if (site.brief == null) missing.push('brief');
  if (site.palette == null) missing.push('palette');
  if (site.motion == null) missing.push('motion');
  if (site.design == null) missing.push('design');
  if (site.unknowns == null) missing.push('unknowns');
  if (site.needsReview == null) missing.push('needsReview');

  if (missing.length > 0) {
    throw new Error(
      `getGeneratedPageForScoring: site ${siteId} の復元に必要な項目が欠けている（${missing.join(', ')}）。` +
        '既定値で埋めず失敗として扱う。',
    );
  }

  const page: GeneratedPage = {
    design: site.design!,
    theme: site.theme,
    palette: site.palette!,
    motion: site.motion!,
    sections: rendered.sections,
    needsReview: site.needsReview!,
    unknowns: site.unknowns!,
  };

  return { brief: site.brief!, page };
}
