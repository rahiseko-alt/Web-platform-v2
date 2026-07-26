/**
 * 生成結果の一時保持（開発用・プロセス内メモリのみ）。
 *
 * 目的はただ1つ: **要素値を差し替えるたびに LLM を呼び直さないため**。
 * 依頼文をキーに直前の生成結果を持っておき、差し替え時はここから読んで
 * 機械の再組み立てだけを行う（課金ゼロ・即時）。
 *
 * 制約（承知の上で受け入れている）:
 * - プロセス内メモリなので dev サーバ再起動で消える（消えたら再生成するだけ）
 * - 永続化は STEP2（DB/クラウド）の範囲。ここで DB を持ち出さない
 */

import type { GeneratedPage } from './types';

const MAX_ENTRIES = 20;
const store = new Map<string, GeneratedPage>();

export function cacheKeyFor(brief: string): string {
  return brief.trim();
}

export function getCachedPage(key: string): GeneratedPage | undefined {
  return store.get(key);
}

/** 上限を超えたら最も古いものから捨てる（メモリ無制限増加の防止） */
export function putCachedPage(key: string, page: GeneratedPage): void {
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, page);
}
