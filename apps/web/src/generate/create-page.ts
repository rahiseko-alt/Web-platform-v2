/**
 * 依頼文1本から GeneratedPage を得るまでの**単一経路**（ロードマップ F-4）。
 *
 * なぜこの関数があるか:
 *   generatePage()（generate.ts）は稼働ループそのもので、LLM クライアントの用意も
 *   キャッシュも失敗の分類も持たない。その周辺手順は当初 app/try/page.tsx と
 *   app/api/generate/route.ts がそれぞれ別実装で持っており、認証済みフロー（ロードマップ B-1）を
 *   足すと同じ手順が3箇所へ複製される状態だった。複製が2箇所のうちにここへ引き上げた。
 *
 * 責務の線引き:
 * - ここが持つ  : LLM クライアントの用意 / キャッシュの読み書き / 生成の実行 / 失敗の分類
 * - ここが持たない: HTTP 応答の組み立て・画面表示（各入口の仕事）、
 *                   overrides の適用（利用者の操作に応じた提示時の関心事）、
 *                   採点（src/eval/。稼働ループと分離する方針は docs/design-notes.md §6-1）
 *
 * 失敗は握りつぶさず outcome として必ず表に出す（既定値での無音フォールバックはしない）。
 * 呼び出し側は status で分岐するだけでよく、例外を握る必要はない。
 */

import { generatePage } from './generate';
import { cacheKeyFor, getCachedPage, putCachedPage } from './cache';
import { createOpenAiClient } from './llm/openai';
import type { LlmClient } from './llm/client';
import type { GeneratedPage, Rejection } from './types';

export type CreatePageOutcome =
  /** 生成成功（または キャッシュ命中）。fromCache:true のとき LLM は呼んでいない */
  | { status: 'ok'; page: GeneratedPage; attempts: number; expanded: boolean; fromCache: boolean }
  /** 機械制御ゲートが全試行で拒否した。拒否理由をそのまま表に出す */
  | { status: 'rejected'; rejections: Rejection[]; attempts: number }
  /** OPENAI_API_KEY が未設定。運用ヒントとして呼び出し側が案内してよい（秘匿値は含まない） */
  | { status: 'no-api-key' }
  /** LLM/内部エラー。詳細はサーバーログへ集約し、呼び出し側へは返さない（docs/design-notes.md §4-1） */
  | { status: 'failed' };

export interface CreatePageInput {
  brief: string;
  /** 差し戻し再試行の上限。未指定は generatePage の既定に委ねる */
  maxRetries?: number;
  /**
   * 依頼文をキーにした生成結果の一時保持を使うか。
   * true にすると、要素の差し替えのたびに LLM を呼び直さずに済む（課金ゼロ・即時）。
   * キャッシュはプロセス内メモリのみ（cache.ts）。
   */
  useCache?: boolean;
}

export interface CreatePageDeps {
  /** テストから fake クライアントを差し込むための口。既定は OpenAI */
  createClient?: () => LlmClient;
}

/** 依頼文1本から GeneratedPage を得る。全ての入口（画面・API・認証済みフロー）はここを通す。 */
export async function createPageFromBrief(
  input: CreatePageInput,
  deps: CreatePageDeps = {},
): Promise<CreatePageOutcome> {
  const { brief, maxRetries, useCache = false } = input;

  const cacheKey = cacheKeyFor(brief);
  if (useCache) {
    const cached = getCachedPage(cacheKey);
    // キャッシュ命中は LLM を呼んでいないので attempts:0・expanded:false で表す
    if (cached) return { status: 'ok', page: cached, attempts: 0, expanded: false, fromCache: true };
  }

  let client: LlmClient;
  try {
    client = (deps.createClient ?? createOpenAiClient)();
  } catch {
    return { status: 'no-api-key' };
  }

  try {
    const result = await generatePage({ brief }, client, maxRetries != null ? { maxRetries } : {});
    if (!result.ok) {
      return { status: 'rejected', rejections: result.rejections, attempts: result.attempts };
    }
    if (useCache) putCachedPage(cacheKey, result.page);
    return {
      status: 'ok',
      page: result.page,
      attempts: result.attempts,
      expanded: result.expanded,
      fromCache: false,
    };
  } catch (error) {
    console.error('createPageFromBrief failed:', error);
    return { status: 'failed' };
  }
}
