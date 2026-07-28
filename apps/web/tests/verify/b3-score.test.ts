import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { SCORE_KEY_ORDER } from '@/eval/rubric';

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

type PathSegment = string | number;

/**
 * 値の中を再帰的に探す（score.ts の collectTexts と同じ意味論：配列・入れ子オブジェクトも辿る）。
 * FAQ/testimonials のような「配列の中のオブジェクトの中の文字列」も対象実験の置換先になり得る。
 * 浅い探索（section.content の直下だけ）だと、その形の本文しか持たないセクションでは
 * 対照実験そのものが実行されず、"見つからない"という無関係な理由で落ちる。
 */
function findInValue(value: unknown, path: readonly PathSegment[]): PathSegment[] | null {
  if (typeof value === 'string') {
    const key = path[path.length - 1];
    if (typeof key === 'string' && NON_TEXT_KEYS.test(key)) return null;
    if (value.trim().length < 15) return null;
    return [...path];
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findInValue(item, [...path, index]);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findInValue(child, [...path, key]);
      if (found) return found;
    }
  }
  return null;
}

/** URL類を除く、15字以上の描画本文の場所を1つ探す（対照実験の置換先）。 */
function findMutableTextPath(
  sections: { content: Record<string, unknown> }[],
): { sectionIndex: number; path: PathSegment[] } | null {
  for (const [sectionIndex, section] of sections.entries()) {
    const found = findInValue(section.content, []);
    if (found) return { sectionIndex, path: found };
  }
  return null;
}

/** path をたどって末端だけを差し替えた複製を返す（元の構造は破壊しない）。 */
function setAtPath(value: unknown, path: readonly PathSegment[], replacement: unknown): unknown {
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = value.slice();
    copy[head as number] = setAtPath(copy[head as number], rest, replacement);
    return copy;
  }
  const record = value as Record<string, unknown>;
  return { ...record, [head as string]: setAtPath(record[head as string], rest, replacement) };
}

describe('B-3-a: 機械採点が実際に採点した値として表示される', () => {
  it('別プロセスからの再計算と、画面に出ていた値が一致する（既定値で埋めない）', async () => {
    const reconstructed = await getGeneratedPageForScoring(observed.siteId);
    expect(reconstructed, `site ${observed.siteId} を復元できない`).not.toBeNull();

    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);

    expect(recomputed.max).toBe(50);
    expect(recomputed.max).toBe(observed.screen.max);
    expect(recomputed.total).toBe(observed.screen.total);

    for (const key of SCORE_KEY_ORDER) {
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
        ? { ...section, content: setAtPath(section.content, target!.path, '不明') as Record<string, unknown> }
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
    const nonMaxKeys = SCORE_KEY_ORDER.filter((key) => observed.screen.items[key].score < observed.screen.items[key].max);
    expect(
      nonMaxKeys.length,
      'この回の生成物は全項目が満点だったため、減点理由の表示を確認できなかった。' +
        '偶然の満点を緑として素通りさせない（SKIP-AS-FAIL）。依頼文を変えて再実行すること。',
    ).toBeGreaterThan(0);
  });

  it('満点でない全ての項目それぞれに、減点理由が画面と再計算の双方で一致して出ている', async () => {
    const reconstructed = await getGeneratedPageForScoring(observed.siteId);
    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);

    for (const key of SCORE_KEY_ORDER) {
      const screenItem = observed.screen.items[key];
      if (screenItem.score >= screenItem.max) continue;

      expect(screenItem.notes.length, `${key} は満点未満なのに画面に理由が1件も出ていない`).toBeGreaterThan(0);
      expect(recomputed.details[key].notes, `${key} の理由が画面と再計算で一致しない（欠けも含む）`).toEqual(
        screenItem.notes,
      );
    }
  });
});
