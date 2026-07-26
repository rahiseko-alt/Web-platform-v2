import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, sections, sites } from '@/db/schema';

/**
 * session取得 + organization所有権チェックの共通ヘルパー（IDOR対策・security-runtime.md準拠）。
 * middleware.ts のCookie存在チェックは optimistic check のため、ここで実体のセッション有効性と
 * 「リソースの organization を誰が createdBy したか」を必ず再検証する（seed-guard.ts と同じ多層防御思想）。
 *
 * 所有権の主体判定: organizations にメンバー中間テーブルが存在しないため、
 * `organizations.createdBy === session.user.id` の単純一致で判定する
 * （メンバー招待機能は本フェーズのスコープ外・plan `stateful-painting-pebble.md` Step2 前提）。
 */

export type OwnershipResult =
  | { ok: true; userId: string; organizationId: string; siteId: string }
  | { ok: false; status: 401 | 403 | 404; message: string };

async function getSessionUserId(requestHeaders: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user.id ?? null;
}

/** siteId 起点の所有権検証（エディタページ用）。 */
export async function requireSiteOwnership(
  siteId: string,
  requestHeaders: Headers,
): Promise<OwnershipResult> {
  const userId = await getSessionUserId(requestHeaders);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };

  const [row] = await db
    .select({ organizationId: sites.organizationId, ownerId: organizations.createdBy })
    .from(sites)
    .innerJoin(organizations, eq(sites.organizationId, organizations.id))
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!row) return { ok: false, status: 404, message: 'Not found' };
  if (row.ownerId !== userId) return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, userId, organizationId: row.organizationId, siteId };
}

/** sectionId 起点の所有権検証（content PATCH API用）。sectionId から site/organization を辿る。 */
export async function requireSectionOwnership(
  sectionId: string,
  requestHeaders: Headers,
): Promise<OwnershipResult> {
  const userId = await getSessionUserId(requestHeaders);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };

  const [row] = await db
    .select({
      organizationId: sections.organizationId,
      siteId: sections.siteId,
      ownerId: organizations.createdBy,
    })
    .from(sections)
    .innerJoin(organizations, eq(sections.organizationId, organizations.id))
    .where(eq(sections.id, sectionId))
    .limit(1);

  if (!row) return { ok: false, status: 404, message: 'Not found' };
  if (row.ownerId !== userId) return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, userId, organizationId: row.organizationId, siteId: row.siteId };
}
