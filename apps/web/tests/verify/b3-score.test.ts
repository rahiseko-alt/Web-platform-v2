import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

/**
 * B-3-a / B-3-b の判定本体。
 *
 * **このファイルはアプリのサーバーを停止したあとに走らせること**（vitest.b3.config.ts 経由・
 * `pnpm --filter web verify:b3`）。tests/e2e/authed-score.spec.ts が実LLMで生成し、
 * 画面に出た値を tests/e2e/.b3-result.json へ書き出す。ここではその観測結果と、
 * **別プロセスから保存先を直接読んで再計算した値**を突き合わせる。
 *
 * 稼働中サーバーと同時に読んでも「読めてしまう」ことがある（pglite は同一 dataDir を
 * 複数プロセスから開ける）ため、「読めたこと」自体は停止の証拠にならない
 * （docs/failures.md 2026-07-28）。停止は CI ワークフロー側のステップ分離・到達性チェックで
 * 担保し、ここでは判定だけを行う。
 */

const RESULT_PATH = path.join(__dirname, '..', 'e2e', '.b3-result.json');

type ScreenItem = { score: number; max: number; notes: string[] };
type ScreenResult = {
  siteId: string;
  screen: {
    total: number;
    max: number;
    items: Record<string, ScreenItem>;
  };
};

const ITEM_KEYS = ['brief', 'length', 'structure', 'honesty', 'variety'] as const;

let getGeneratedPageForScoring: typeof import('@/db/queries/generated-page').getGeneratedPageForScoring;
let scorePage: typeof import('@/eval/score').scorePage;
let NON_TEXT_KEYS: typeof import('@/eval/score').NON_TEXT_KEYS;
let observed: ScreenResult;

beforeAll(async () => {
  ({ getGeneratedPageForScoring } = await import('@/db/queries/generated-page'));
  ({ scorePage, NON_TEXT_KEYS } = await import('@/eval/score'));

  let raw: string;
  try {
    raw = await readFile(RESULT_PATH, 'utf-8');
  } catch (error) {
    throw new Error(
      `画面側の観測結果 (${RESULT_PATH}) が読めません。受入 E2E が最後まで走っていない可能性があります: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  observed = JSON.parse(raw) as ScreenResult;
});

/** URL類を除く、15字以上の描画本文の場所を1つ探す（対照実験の置換先）。 */
function findMutableTextPath(
  sections: { content: Record<string, unknown> }[],
): { sectionIndex: number; key: string } | null {
  for (const [sectionIndex, section] of sections.entries()) {
    for (const [key, value] of Object.entries(section.content)) {
      if (typeof value !== 'string') continue;
      if (NON_TEXT_KEYS.test(key)) continue;
      if (value.trim().length < 15) continue;
      return { sectionIndex, key };
    }
  }
  return null;
}

describe('B-3-a: 機械採点が実際に採点した値として表示される', () => {
  it('別プロセスからの再計算と、画面に出ていた値が一致する（既定値で埋めない）', async () => {
    const reconstructed = await getGeneratedPageForScoring(observed.siteId);
    expect(reconstructed, `site ${observed.siteId} を復元できない`).not.toBeNull();

    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);

    expect(recomputed.max).toBe(50);
    expect(recomputed.max).toBe(observed.screen.max);
    expect(recomputed.total).toBe(observed.screen.total);

    for (const key of ITEM_KEYS) {
      const screenItem = observed.screen.items[key];
      expect(screenItem, `画面に項目 ${key} が出ていない`).toBeDefined();
      const recomputedDetail = recomputed.details[key];
      expect(recomputedDetail.score, `${key} の点数が画面と再計算で異なる`).toBe(screenItem.score);
      expect(recomputedDetail.max, `${key} の満点が画面と再計算で異なる`).toBe(screenItem.max);
    }
  });

  it('対照：本文1箇所をプレースホルダへ置き換えると合計点が下がる（入力を読んでいることの確認）', async () => {
    const reconstructed = await getGeneratedPageForScoring(observed.siteId);
    expect(reconstructed).not.toBeNull();

    const original = scorePage(reconstructed!.brief, reconstructed!.page);

    const target = findMutableTextPath(reconstructed!.page.sections);
    expect(target, '対照実験に使える15字以上の本文フィールドが見つからない').not.toBeNull();

    const mutatedSections = reconstructed!.page.sections.map((section, index) =>
      index === target!.sectionIndex
        ? { ...section, content: { ...section.content, [target!.key]: '不明' } }
        : section,
    );
    const mutatedPage = { ...reconstructed!.page, sections: mutatedSections };
    const mutated = scorePage(reconstructed!.brief, mutatedPage);

    expect(mutated.total, '本文を壊しても点数が変わらない＝入力を読んでいない疑いがある').toBeLessThan(
      original.total,
    );
  });
});

describe('B-3-b: 満点でない項目に、なぜ引かれたのかの説明が漏れなく読める', () => {
  it('満点未満の項目が1つ以上ある（無ければこの回では受入を確認できないので失敗とする）', () => {
    const nonMaxKeys = ITEM_KEYS.filter((key) => observed.screen.items[key].score < observed.screen.items[key].max);
    expect(
      nonMaxKeys.length,
      'この回の生成物は全項目が満点だったため、減点理由の表示を確認できなかった。' +
        '偶然の満点を緑として素通りさせない（SKIP-AS-FAIL）。依頼文を変えて再実行すること。',
    ).toBeGreaterThan(0);
  });

  it('満点でない全ての項目それぞれに、減点理由が画面と再計算の双方で一致して出ている', async () => {
    const reconstructed = await getGeneratedPageForScoring(observed.siteId);
    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);

    for (const key of ITEM_KEYS) {
      const screenItem = observed.screen.items[key];
      if (screenItem.score >= screenItem.max) continue;

      expect(screenItem.notes.length, `${key} は満点未満なのに画面に理由が1件も出ていない`).toBeGreaterThan(0);
      expect(recomputed.details[key].notes, `${key} の理由が画面と再計算で一致しない（欠けも含む）`).toEqual(
        screenItem.notes,
      );
    }
  });
});
