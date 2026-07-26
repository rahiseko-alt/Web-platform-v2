import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { db } from '@/db';
import {
  contentEntries,
  organizations,
  pages,
  sections,
  sites,
  users,
} from '@/db/schema';
import type * as schema from '@/db/schema';
import type { TemplateDefinition } from '@/templates/types';
import generalTemplate001 from '@/templates/definitions/general-001';
import generalTemplate002 from '@/templates/definitions/general-002';
import { sectionContentByTemplate } from './fixtures/section-content';

export type SeedResult = {
  userId: string;
  sites: Array<{ templateId: string; siteId: string; theme: string }>;
};

const templateDefinitions: TemplateDefinition[] = [generalTemplate001, generalTemplate002];

/**
 * PGliteへマイグレーション適用 + 検証用データ投入。
 * 冪等化のため実行のたびに既存データをFK逆順で全削除してから再投入する。
 * 投入順序はNOT NULL制約(created_by/organization_id/site_id)を満たすため
 * users -> organizations -> sites -> pages -> sections -> content_entries に固定する。
 */
export async function buildSeed(): Promise<SeedResult> {
  // db/index.ts:28-41 と同じ DATABASE_URL 有無判定をここに複製する（db.ts は変更しない）。
  // Neon(node-postgres)/PGlite でmigratorの要求する具体型が異なるため、共通Proxy型からキャストする。
  if (process.env.DATABASE_URL) {
    await migrateNodePg(db as unknown as NodePgDatabase<typeof schema>, {
      migrationsFolder: './drizzle',
    });
  } else {
    await migratePglite(db as unknown as PgliteDatabase<typeof schema>, {
      migrationsFolder: './drizzle',
    });
  }

  await db.delete(contentEntries);
  await db.delete(sections);
  await db.delete(pages);
  await db.delete(sites);
  await db.delete(organizations);
  await db.delete(users);

  const [user] = await db
    .insert(users)
    .values({ name: 'Seed Owner', email: 'seed-owner@example.com' })
    .returning({ id: users.id });
  if (!user) throw new Error('buildSeed: failed to insert seed user');
  const userId = user.id;

  const result: SeedResult = { userId, sites: [] };

  for (const def of templateDefinitions) {
    const [org] = await db
      .insert(organizations)
      .values({ name: `${def.templateId} organization`, createdBy: userId })
      .returning({ id: organizations.id });
    if (!org) throw new Error(`buildSeed: failed to insert organization for ${def.templateId}`);

    const [site] = await db
      .insert(sites)
      .values({
        organizationId: org.id,
        name: `${def.templateId} site`,
        templateId: def.templateId,
        theme: def.theme,
        createdBy: userId,
      })
      .returning({ id: sites.id });
    if (!site) throw new Error(`buildSeed: failed to insert site for ${def.templateId}`);

    result.sites.push({ templateId: def.templateId, siteId: site.id, theme: def.theme });

    for (const pageDef of def.pages) {
      const [page] = await db
        .insert(pages)
        .values({
          organizationId: org.id,
          siteId: site.id,
          slug: pageDef.slug,
          createdBy: userId,
        })
        .returning({ id: pages.id });
      if (!page) throw new Error(`buildSeed: failed to insert page ${pageDef.slug}`);

      for (const [index, sectionType] of pageDef.sections.entries()) {
        const [section] = await db
          .insert(sections)
          .values({
            organizationId: org.id,
            siteId: site.id,
            pageId: page.id,
            sectionType,
            order: index,
            createdBy: userId,
          })
          .returning({ id: sections.id });
        if (!section) throw new Error(`buildSeed: failed to insert section ${sectionType}`);

        const content = sectionContentByTemplate[def.templateId]?.[sectionType] ?? {};
        for (const [key, value] of Object.entries(content)) {
          await db.insert(contentEntries).values({
            organizationId: org.id,
            siteId: site.id,
            sectionId: section.id,
            key,
            value,
            createdBy: userId,
          });
        }
      }
    }
  }

  return result;
}
