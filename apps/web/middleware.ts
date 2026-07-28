import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * `/editor/**`・`/api/content/**`・`/generate/**` の一次遮断（optimistic check）。
 * Edge runtime では DB 接続（pg Pool / PGlite）を張れないため、ここでは Cookie の存在のみを見る
 * （seedGuard.ts と同じ多層防御思想: この層だけで認可を完結させない）。
 * Cookie 偽装・失効セッションでの通過は、各 route/page 側で `auth.api.getSession()` を呼び
 * 実体のセッション検証・organization 所有権チェック（IDOR対策）を必ず行うこと。
 * `/preview/**` はここでは扱わず公開のまま（matcher対象外）。
 */
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/editor/:path*', '/api/content/:path*', '/generate/:path*'],
};
