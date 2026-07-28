import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, sections, sites } from '@/db/schema';

/**
 * session取得 + organization所有権チェックの共通ヘルパー（IDOR対策・docs/design-notes.md §4-3 準拠）。
 * middleware.ts のCookie存在チェックは optimistic check のため、ここで実体のセッション有効性と
 * 「リソースの organization を誰が createdBy したか」を必ず再検証する（seed-guard.ts と同じ多層防御思想）。
 *
 * 所有権の主体判定: organizations にメンバー中間テーブルが存在しないため、
 * `organizations.createdBy === session.user.id` の単純一致で判定する
 * （メンバー招待機能は本フェーズのスコープ外・docs/design-notes.md §9）。
 */

export type OwnershipResult =
  | { ok: true; userId: string; organizationId: string; siteId: string }
  | { ok: false; status: 401 | 403 | 404; message: string };

/** 所有権を伴わない「ログインしているか」だけの判定結果（生成フロー等、リソース未確定の入口用）。 */
export type SessionResult = { ok: true; userId: string } | { ok: false; status: 401; message: string };

async function getSessionUserId(requestHeaders: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  // user まで optional chaining する。ここは認可境界なので、想定外の形の応答が来たときに
  // 例外（＝500）で落ちるのではなく null（＝クリーンに 401 拒否）へ倒す。
  return session?.user?.id ?? null;
}

/**
 * セッション有効性のみの検証（所有権チェックは伴わない）。
 * 生成フロー（ロードマップ B-1）のように、アクセス対象のリソースがまだ存在しない入口で使う。
 * middleware.ts の Cookie 存在チェックは optimistic check のため、ここで実体のセッションを再検証する
 * （requireSiteOwnership / requireSectionOwnership と同じ多層防御思想）。
 */
export async function requireSession(requestHeaders: Headers): Promise<SessionResult> {
  const userId = await getSessionUserId(requestHeaders);
  if (!userId) return { ok: false, status: 401, message: 'Unauthorized' };
  return { ok: true, userId };
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
