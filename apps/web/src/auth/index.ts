import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import * as schema from '../db/schema';

/**
 * フェーズ1: email/password のみ（docs/architecture-decision-0.md §4 権限構造準拠。マスター確定でOAuthは今回スコープ外）。
 * usePlural: true — 既存スキーマの命名規約（複数形テーブル名: users/sessions/accounts/verifications）に
 * Better Auth 側のモデル名（user/session/account/verification）を合わせるため。
 * schema を明示指定し、drizzle-adapter が `../db/schema` のテーブルオブジェクトを解決できるようにする。
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  // 既存の uuid PK（defaultRandom() = Postgres gen_random_uuid()）を維持するため、
  // Better Auth 側の自前ID生成（既定はUUID形式でない乱数文字列）を無効化しDBのDEFAULTに委ねる。
  advanced: {
    database: {
      generateId: false,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  // signup/login は認証不要エンドポイントのためレートリミット必須（security-runtime.md準拠）。
  // better-auth は既定で /sign-in, /sign-up, /change-password, /change-email に window:10s max:3 の
  // special rule を内蔵するが、既定では production 環境でのみ有効なため、
  // dev/Windows実機検証でも機能させるため enabled を明示的に true にする。
  // storage既定はmemory（単一プロセス前提。複数インスタンス共有はseed-guard.tsと同様に将来課題）。
  rateLimit: {
    enabled: true,
  },
});
