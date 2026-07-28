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

/**
 * キャッシュキー。**依頼文だけでキーを作ってはいけない**。
 *
 * store はプロセス内で全利用者に共有されるため、依頼文だけをキーにすると
 * 「別の人が同じ言い回しで依頼すると、他人の生成結果がそのまま返る」状態になる。
 * 認証済みフロー（B-2-a）ではこれが実害になっていた: 2人目は fromCache:true になるので
 * 保存がスキップされ、**画面にはLPが出るのに、その人の持ち物としては1件も残らない**。
 *
 * そこで所有者（scope）をキーへ畳み込む。scope を渡さない口（未認証のローカル開発口）は
 * 共有の 'anon' 空間に入るが、そこは所有物の概念が無いので問題にならない。
 */
export function cacheKeyFor(brief: string, scope?: string): string {
  // 区切りに改行を使う。scope は uuid（改行を含まない）なので、
  // 「scope 末尾と brief 先頭がくっついて別の組み合わせと衝突する」ことが起きない。
  return `${scope ?? 'anon'}\n${brief.trim()}`;
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
