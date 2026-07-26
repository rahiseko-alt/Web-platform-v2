import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/auth';

/**
 * Better Auth の全エンドポイント（sign-in/sign-up/session/sign-out 等）をこの1ルートへ委譲する。
 * 個別バリデーション・レートリミットは auth インスタンス側（src/auth/index.ts）の設定に従う。
 */
export const { GET, POST } = toNextJsHandler(auth);
