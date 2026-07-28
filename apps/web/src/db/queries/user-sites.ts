/**
 * 「自分のサイト一覧」の取得（ロードマップ B-2-b / B-2-c）。
 *
 * ここは **リソース単位のガード（requireSiteOwnership）を通らない新しい経路** である点に注意。
 * requireSiteOwnership は「この siteId を触ってよいか」を後から検問するものなので、
 * 一覧のように siteId が未確定な経路では効かない。所有者での絞り込みはこのクエリ自身の責任であり、
 * WHERE から organizations.createdBy が落ちた瞬間に他人のサイトが一覧へ漏れる（B-2-c が守る事実）。
 *
 * 所有の主体判定は api-guard.ts / save-generated-page.ts と同じ
 * **organizations.createdBy === userId** に揃える（判定方式を増やさない）。
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations, sites } from '@/db/schema';

export type UserSiteSummary = {
  id: string;
  name: string;
  /** このサイトを生んだ依頼文。テンプレ由来のサイトでは null */
  brief: string | null;
  theme: string;
  templateId: string;
  createdAt: Date;
};

/**
 * そのユーザーが所有するサイトを新しい順で返す。所有していなければ空配列。
 * 他人のサイトは**構造的に**返らない（innerJoin + createdBy 一致）。
 */
export async function listSitesForUser(userId: string): Promise<UserSiteSummary[]> {
  return db
    .select({
      id: sites.id,
      name: sites.name,
      brief: sites.brief,
      theme: sites.theme,
      templateId: sites.templateId,
      createdAt: sites.createdAt,
    })
    .from(sites)
    .innerJoin(organizations, eq(sites.organizationId, organizations.id))
    .where(eq(organizations.createdBy, userId))
    .orderBy(desc(sites.createdAt));
}
