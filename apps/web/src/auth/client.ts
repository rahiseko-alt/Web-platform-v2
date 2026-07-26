import { createAuthClient } from 'better-auth/react';

/**
 * クライアント側 Better Auth インスタンス。baseURL は同一オリジンの
 * `/api/auth/*`（app/api/auth/[...all]/route.ts）に既定で解決される。
 */
export const authClient = createAuthClient();
