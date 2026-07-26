/**
 * 汎用固定窓レートリミッタのファクトリ。key（userId等）別にカウンタを持つ。
 * seed-guard.ts の埋め込み実装と同じ固定窓アルゴリズムだが、キー別に複数系統を扱えるよう汎用化した。
 * プロセス内メモリのため複数インスタンス/サーバレスでは共有されない
 * （本番共有化はフェーズ1後続 plan の別項目・現状は単一プロセス前提）。
 */

export type RateLimitCheckResult = { ok: true } | { ok: false; retryAfterSec: number };

export type FixedWindowLimiter = {
  check(key: string, now?: number): RateLimitCheckResult;
  reset(key?: string): void;
};

export function createFixedWindowLimiter(options: { max: number; windowMs: number }): FixedWindowLimiter {
  const state = new Map<string, { windowStart: number; count: number }>();

  return {
    check(key: string, now: number = Date.now()): RateLimitCheckResult {
      const entry = state.get(key) ?? { windowStart: now, count: 0 };
      if (now - entry.windowStart >= options.windowMs) {
        entry.windowStart = now;
        entry.count = 0;
      }
      entry.count += 1;
      state.set(key, entry);
      if (entry.count > options.max) {
        const retryAfterSec = Math.ceil((entry.windowStart + options.windowMs - now) / 1000);
        return { ok: false, retryAfterSec };
      }
      return { ok: true };
    },
    reset(key?: string) {
      if (key) state.delete(key);
      else state.clear();
    },
  };
}
