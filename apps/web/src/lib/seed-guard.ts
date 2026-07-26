import { timingSafeEqual } from 'node:crypto';

/**
 * seed エンドポイントの多層防御（advisory A-3）。
 * 単層（NODE_ENV 比較のみ）だと本番混入時に全データ破壊 + DoS の露出面になるため、
 * (1)本番遮断 (2)トークン fail-closed (3)固定窓レートリミット の3層で判定する。
 * route を薄く・テスト可能に保つためロジックを分離する。
 */

export type SeedGuardResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 429; message: string; retryAfterSec?: number };

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;

// プロセス内メモリの固定窓カウンタ。複数インスタンス/サーバレスでは共有されない
// （本番共有は仮説#2 auth plan で Redis 等へ移行。現状ローカル単一プロセス前提）。
const rateState: { windowStart: number; count: number } = { windowStart: 0, count: 0 };

/** テスト用: レート窓カウンタを初期化する */
export function resetSeedRateLimit(): void {
  rateState.windowStart = 0;
  rateState.count = 0;
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}

/** 長さ差でも情報を漏らさない定数時間比較 */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function checkRateLimit(now: number): SeedGuardResult {
  if (now - rateState.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateState.windowStart = now;
    rateState.count = 0;
  }
  rateState.count += 1;
  if (rateState.count > RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((rateState.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { ok: false, status: 429, message: 'Too many requests', retryAfterSec };
  }
  return { ok: true };
}

/**
 * seed 実行可否を判定する。
 * @param authHeader Authorization ヘッダ値（`Bearer <token>`）
 * @param env NODE_ENV / SEED_TOKEN（既定は process.env。テストで注入可能）
 * @param now 現在時刻ms（テストで注入可能）
 */
export function evaluateSeedGuard(
  authHeader: string | null,
  env: { nodeEnv?: string; seedToken?: string } = {
    nodeEnv: process.env.NODE_ENV,
    seedToken: process.env.SEED_TOKEN,
  },
  now: number = Date.now(),
): SeedGuardResult {
  // 層1: 本番は常に遮断（NODE_ENV 誤設定時の保険として他層も残す）
  if (env.nodeEnv === 'production') {
    return { ok: false, status: 403, message: 'Not available in production' };
  }
  // 層2: トークン fail-closed（未設定なら実行不可）
  if (!env.seedToken) {
    return { ok: false, status: 403, message: 'Seed disabled: SEED_TOKEN is not configured' };
  }
  // 層3: レートリミット（トークン照合の前に評価する）。
  // 認証成否に関わらずカウントすることで、不正トークンの総当たり/無認証フラッドも 429 で抑止する。
  const rate = checkRateLimit(now);
  if (!rate.ok) return rate;
  // 層4: トークン照合
  const provided = extractBearer(authHeader);
  if (!provided || !tokensMatch(provided, env.seedToken)) {
    return { ok: false, status: 401, message: 'Invalid or missing seed token' };
  }
  return { ok: true };
}
