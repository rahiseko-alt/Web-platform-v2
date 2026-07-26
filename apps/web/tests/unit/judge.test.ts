import { describe, it, expect } from 'vitest';
import { judgePage, collectJudgeScores } from '@/eval/judge';
import { JUDGE_TOTAL, JUDGE_WEIGHTS } from '@/eval/rubric';
import type { GeneratedPage } from '@/generate/types';
import type { LlmClient } from '@/generate/llm/client';
import type { EvalCaseInput } from '@/eval/report';

/**
 * 主観40点採点（judge.ts）の検証。LLM・ネットワーク不要。
 * fake client が固定応答/例外を返すことで、成功・クランプ・失敗系を決定的に再現する。
 */

const BRIEF = '渋谷のネイルサロンのサイト。料金と予約を見せたい。';

function fakeClient(response: string | (() => never)): LlmClient {
  return {
    async complete() {
      if (typeof response === 'function') return response();
      return response;
    },
  };
}

function makePage(): GeneratedPage {
  return {
    design: { heroVariant: 'split-editorial', rhythm: 'loose', align: 'asymmetric', sectionVariants: {} },
    theme: 'minimal-corporate',
    palette: 'light-gray',
    motion: 'subtle',
    needsReview: false,
    unknowns: [],
    sections: [
      {
        id: 'hero-01-0',
        sectionType: 'hero-01',
        order: 0,
        content: {
          title: '渋谷の隠れ家ネイルサロン',
          subtitle: '一人ひとりに合うデザインをご提案します。',
        },
      },
    ],
  };
}

describe('judgePage', () => {
  it('正常な JSON 応答から3軸合計を計算する', async () => {
    const client = fakeClient(
      JSON.stringify({
        tone: { score: 12, note: '業種に合っている' },
        copyQuality: { score: 10, note: 'やや定型的' },
        overall: { score: 8, note: '概ね良い' },
      }),
    );

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judgeFailure).toBeUndefined();
    expect(result.judge?.total).toBe(30);
    expect(result.judge?.max).toBe(JUDGE_TOTAL);
    expect(result.judge?.details.tone.score).toBe(12);
    expect(result.judge?.details.tone.max).toBe(JUDGE_WEIGHTS.tone);
    expect(result.judge?.details.tone.notes).toEqual(['業種に合っている']);
  });

  it('コードフェンス付きの応答も剥がして parse する', async () => {
    const client = fakeClient(
      '```json\n' +
        JSON.stringify({
          tone: { score: 15, note: '' },
          copyQuality: { score: 15, note: '' },
          overall: { score: 10, note: '' },
        }) +
        '\n```',
    );

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judge?.total).toBe(40);
  });

  it('note が null（JSON mode の LLM が「理由なし」で返す形）でも失敗にしない', async () => {
    const client = fakeClient(
      JSON.stringify({
        tone: { score: 12, note: null },
        copyQuality: { score: 10, note: null },
        overall: { score: 8, note: null },
      }),
    );

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judgeFailure).toBeUndefined();
    expect(result.judge?.total).toBe(30);
    expect(result.judge?.details.tone.notes).toEqual([]);
  });

  it('範囲外スコア（負数・max超過）はクランプされる', async () => {
    const client = fakeClient(
      JSON.stringify({
        tone: { score: -5, note: '' },
        copyQuality: { score: 999, note: '' },
        overall: { score: 10, note: '' },
      }),
    );

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judge?.details.tone.score).toBe(0);
    expect(result.judge?.details.copyQuality.score).toBe(JUDGE_WEIGHTS.copyQuality);
  });

  it('不正な JSON は judgeFailure を返し judge は付かない', async () => {
    const client = fakeClient('これはJSONではありません');

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judge).toBeUndefined();
    expect(result.judgeFailure).toMatch(/JSON parse/);
  });

  it('スキーマ不一致（必須軸の欠落）は judgeFailure を返す', async () => {
    const client = fakeClient(JSON.stringify({ tone: { score: 10 } }));

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judge).toBeUndefined();
    expect(result.judgeFailure).toMatch(/形式が不正/);
  });

  it('client.complete が例外を投げても judgeFailure で吸収する', async () => {
    const client = fakeClient(() => {
      throw new Error('network down');
    });

    const result = await judgePage(BRIEF, makePage(), client);

    expect(result.judge).toBeUndefined();
    expect(result.judgeFailure).toMatch(/LLM 呼び出し/);
  });
});

describe('collectJudgeScores', () => {
  it('page を持つ case だけ judge を回し、生成失敗 case はスキップする', async () => {
    const client = fakeClient(
      JSON.stringify({
        tone: { score: 10, note: '' },
        copyQuality: { score: 10, note: '' },
        overall: { score: 5, note: '' },
      }),
    );
    const cases: EvalCaseInput[] = [
      { brief: BRIEF, page: makePage() },
      { brief: '生成に失敗した依頼文', failure: 'ゲート拒否' },
    ];

    const results = await collectJudgeScores(cases, client);

    expect(results[0].judge?.total).toBe(25);
    expect(results[1].judge).toBeUndefined();
    expect(results[1].judgeFailure).toBeUndefined();
    expect(results[1].failure).toBe('ゲート拒否');
  });
});
