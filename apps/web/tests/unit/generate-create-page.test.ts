import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { createPageFromBrief } from '@/generate/create-page';
import { getCachedPage, cacheKeyFor } from '@/generate/cache';
import type { LlmClient } from '@/generate/llm/client';
import { validLlmOutputJson } from '../fixtures/valid-llm-output';

/**
 * 生成の単一経路 createPageFromBrief() の検証（ロードマップ F-4）。API キー・ネットワーク不要。
 *
 * ここで守るのは2つ:
 * 1. 手順の中身（キャッシュ・失敗の分類）が期待どおりであること
 * 2. **入口が手順を再実装していないこと**（構造ガード）。1 だけだと、後から
 *    app/ 側に生成手順を書き足しても緑のままになり、複製が再発する。
 */

/** 常に同じ応答を返す fake。呼ばれた回数を数える */
function fakeClient(response: string): LlmClient & { calls: number } {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    async complete() {
      state.calls += 1;
      return response;
    },
  };
}

/** 呼ばれたら即失敗する fake（「LLM を呼んでいない」ことの証明に使う） */
function forbiddenClient(): LlmClient {
  return {
    async complete(): Promise<string> {
      throw new Error('LLM を呼んではいけない経路で呼び出された');
    },
  };
}

const BRIEF = '渋谷のネイルサロン（create-page テスト専用の依頼文）';

describe('createPageFromBrief（生成の単一経路）', () => {
  beforeEach(() => {
    // キャッシュはプロセス内メモリ。テスト間で状態を持ち越さないよう毎回別の依頼文を使う
  });

  it('APIキーが用意できないときは no-api-key を返す（例外を投げない）', async () => {
    const outcome = await createPageFromBrief(
      { brief: `${BRIEF}-nokey` },
      {
        createClient: () => {
          throw new Error('OPENAI_API_KEY 未設定');
        },
      },
    );
    expect(outcome.status).toBe('no-api-key');
  });

  it('LLM 呼び出しが例外を投げたら failed へ丸める（詳細を呼び出し側へ渡さない）', async () => {
    const outcome = await createPageFromBrief(
      { brief: `${BRIEF}-throw` },
      { createClient: () => ({ async complete(): Promise<string> { throw new Error('boom'); } }) },
    );
    expect(outcome.status).toBe('failed');
    // 例外メッセージが outcome に載っていないこと（載せると画面/APIへ漏れうる）
    expect(JSON.stringify(outcome)).not.toContain('boom');
  });

  it('機械ゲートが全試行で拒否したら rejected を拒否理由つきで返す', async () => {
    const client = fakeClient('ここにデザイン案を書きました……'); // JSON ですらない
    const outcome = await createPageFromBrief(
      { brief: `${BRIEF}-rejected`, maxRetries: 1 },
      { createClient: () => client },
    );

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.attempts).toBe(2); // 初回 + 差し戻し1回
    expect(outcome.rejections.length).toBeGreaterThan(0);
  });

  it('useCache:true なら生成結果をキャッシュへ書き、2回目は LLM を呼ばずに返す', async () => {
    const brief = `${BRIEF}-cache`;
    const client = fakeClient(validLlmOutputJson());

    const first = await createPageFromBrief({ brief, useCache: true }, { createClient: () => client });
    expect(first.status).toBe('ok');
    if (first.status !== 'ok') return;
    expect(first.fromCache).toBe(false);
    expect(client.calls).toBeGreaterThan(0);
    expect(getCachedPage(cacheKeyFor(brief))).toBeDefined();

    // 2回目は LLM を呼んだら失敗する client を渡す＝呼ばないことを証明する
    const second = await createPageFromBrief({ brief, useCache: true }, { createClient: forbiddenClient });
    expect(second.status).toBe('ok');
    if (second.status !== 'ok') return;
    expect(second.fromCache).toBe(true);
    expect(second.page).toEqual(first.page);
  });

  it('useCache:false ならキャッシュへ書かない（API 経路の既定挙動）', async () => {
    const brief = `${BRIEF}-nocache`;
    const client = fakeClient(validLlmOutputJson());

    const outcome = await createPageFromBrief({ brief, useCache: false }, { createClient: () => client });
    expect(outcome.status).toBe('ok');
    expect(getCachedPage(cacheKeyFor(brief))).toBeUndefined();
  });
});

/**
 * 構造ガード：入口（app/）が生成手順を再実装していないこと。
 * app/try と app/api/generate は outcome を画面/HTTP へ写すだけで、稼働ループや
 * LLM クライアント生成、キャッシュ操作を直接触ってはいけない。
 */
describe('生成手順の単一経路が保たれている（複製の再発防止）', () => {
  const APP_DIR = path.join(__dirname, '..', '..', 'app');
  const ENTRY_POINTS = ['try/page.tsx', 'api/generate/route.ts'];

  /** 入口が直接触ってはいけない＝単一経路の内部にあるべきもの */
  const FORBIDDEN = [
    { pattern: /from ['"]@\/generate\/generate['"]/, why: '稼働ループを入口から直接呼んでいる' },
    { pattern: /from ['"]@\/generate\/llm\//, why: 'LLM クライアントの生成を入口が持っている' },
    { pattern: /from ['"]@\/generate\/cache['"]/, why: 'キャッシュ操作を入口が持っている' },
  ];

  it.each(ENTRY_POINTS)('%s は createPageFromBrief を経由する', (entry) => {
    const source = readFileSync(path.join(APP_DIR, entry), 'utf-8');
    expect(source).toMatch(/from ['"]@\/generate\/create-page['"]/);
  });

  it.each(ENTRY_POINTS)('%s は生成手順を再実装しない', (entry) => {
    const source = readFileSync(path.join(APP_DIR, entry), 'utf-8');
    const violations = FORBIDDEN.filter((f) => f.pattern.test(source)).map((f) => f.why);
    expect(violations).toEqual([]);
  });
});
