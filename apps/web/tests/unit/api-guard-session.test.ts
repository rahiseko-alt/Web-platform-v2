import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * requireSession（ロードマップ B-1 の認証済み入口が使うセッション検証）の単体検証。
 *
 * ここで守るのは「セッションが無ければ通さない」という 1 点。
 * better-auth 本体（実DB・実cookie）の検証は独立検証（A-2）側の担当なので、
 * ここでは auth.api.getSession をモックして**分岐だけ**を機械で固定する。
 *
 * 併せて、認証済み入口が middleware だけに頼っていない（多層防御になっている）ことの
 * 構造ガードも置く。middleware は Edge runtime で Cookie の存在しか見ないため、
 * ページ側が requireSession を呼ばなくなると失効セッションで通過してしまう。
 */

const getSession = vi.fn();

vi.mock('@/auth', () => ({
  auth: { api: { get getSession() { return getSession; } } },
}));

vi.mock('@/db', () => ({ db: {} }));

const { requireSession } = await import('@/lib/api-guard');

beforeEach(() => {
  getSession.mockReset();
});

describe('requireSession', () => {
  it('セッションが無ければ 401 で拒否する', async () => {
    getSession.mockResolvedValue(null);

    const result = await requireSession(new Headers());

    expect(result).toEqual({ ok: false, status: 401, message: 'Unauthorized' });
  });

  it('セッションはあるが user が欠けていれば 401 で拒否する', async () => {
    getSession.mockResolvedValue({ session: { id: 's1' } });

    const result = await requireSession(new Headers());

    expect(result.ok).toBe(false);
  });

  it('有効なセッションなら userId を返して通す', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-123' } });

    const result = await requireSession(new Headers());

    expect(result).toEqual({ ok: true, userId: 'user-123' });
  });

  it('リクエストヘッダをそのまま getSession へ渡す（cookie を落とさない）', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-123' } });
    const headers = new Headers({ cookie: 'better-auth.session_token=abc' });

    await requireSession(headers);

    expect(getSession).toHaveBeenCalledWith({ headers });
  });
});

/**
 * 構造ガード：認証が要る入口が middleware だけに頼っていないこと（多層防御）。
 * middleware.ts は Edge runtime のため Cookie の存在しか見ない。ページ側が実体検証を
 * やめると、失効セッション・偽装 Cookie で通過する（A-4 の検証で実測済みの性質）。
 */
describe('認証済み入口は middleware だけに頼らない（多層防御の維持）', () => {
  const APP_DIR = path.join(__dirname, '..', '..', 'app');
  const GUARDED_ENTRIES = [
    { file: 'generate/page.tsx', guard: /requireSession/ },
    { file: 'editor/[siteId]/page.tsx', guard: /requireSiteOwnership/ },
  ];

  it.each(GUARDED_ENTRIES)('$file は自前で実体のセッション検証を行う', ({ file, guard }) => {
    const source = readFileSync(path.join(APP_DIR, file), 'utf-8');
    expect(source).toMatch(guard);
  });

  it('middleware の matcher が /generate を保護対象に含む', () => {
    const source = readFileSync(path.join(__dirname, '..', '..', 'middleware.ts'), 'utf-8');
    expect(source).toMatch(/'\/generate\/:path\*'/);
  });
});
