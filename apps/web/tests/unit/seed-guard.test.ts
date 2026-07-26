import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateSeedGuard, resetSeedRateLimit } from '@/lib/seed-guard';

const VALID = 'test-seed-token';
const devEnv = { nodeEnv: 'development', seedToken: VALID };
const bearer = (t: string) => `Bearer ${t}`;

describe('evaluateSeedGuard', () => {
  beforeEach(() => resetSeedRateLimit());

  it('本番は token 有無に関わらず 403', () => {
    const r = evaluateSeedGuard(bearer(VALID), { nodeEnv: 'production', seedToken: VALID });
    expect(r).toEqual({ ok: false, status: 403, message: expect.stringContaining('production') });
  });

  it('SEED_TOKEN 未設定なら fail-closed で 403', () => {
    const r = evaluateSeedGuard(bearer(VALID), { nodeEnv: 'development', seedToken: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('Authorization ヘッダ欠落は 401', () => {
    const r = evaluateSeedGuard(null, devEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('token 不一致は 401', () => {
    const r = evaluateSeedGuard(bearer('wrong'), devEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('token 一致は許可', () => {
    expect(evaluateSeedGuard(bearer(VALID), devEnv, 1_000)).toEqual({ ok: true });
  });

  it('同一窓で上限超過すると 429 + Retry-After', () => {
    const now = 5_000;
    for (let i = 0; i < 5; i += 1) {
      expect(evaluateSeedGuard(bearer(VALID), devEnv, now)).toEqual({ ok: true });
    }
    const over = evaluateSeedGuard(bearer(VALID), devEnv, now);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.status).toBe(429);
      expect(over.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('窓が経過すればカウンタがリセットされ再び許可', () => {
    const start = 10_000;
    for (let i = 0; i < 5; i += 1) evaluateSeedGuard(bearer(VALID), devEnv, start);
    // 10s 窓を超えた時刻
    expect(evaluateSeedGuard(bearer(VALID), devEnv, start + 10_001)).toEqual({ ok: true });
  });

  it('不正トークンの連投もレート制限で 429（総当たり/フラッド抑止）', () => {
    const now = 20_000;
    // 上限まではトークン不一致で 401（レート層は通過）
    for (let i = 0; i < 5; i += 1) {
      const r = evaluateSeedGuard(bearer('wrong'), devEnv, now);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
    }
    // 上限超過は照合前に 429 で遮断される
    const over = evaluateSeedGuard(bearer('wrong'), devEnv, now);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(429);
  });
});
