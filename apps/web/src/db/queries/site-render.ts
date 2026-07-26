import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { contentEntries, pages, sections, sites } from '@/db/schema';

export type RenderableSection = {
  id: string;
  sectionType: string;
  order: number;
  content: Record<string, unknown>;
};

export type RenderablePage = {
  site: { id: string; theme: string; templateId: string };
  page: { id: string; slug: string };
  sections: RenderableSection[];
};

/**
 * DB→レンダリングパイプラインの核。content_entries（縦持ち）をsection単位のRecordへ畳み込む。
 */
export async function getRenderablePage(siteId: string, slug: string): Promise<RenderablePage | null> {
  const [siteRow] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!siteRow) return null;

  const [pageRow] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug)))
    .limit(1);
  if (!pageRow) return null;

  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.pageId, pageRow.id))
    .orderBy(asc(sections.order));

  const sectionIds = sectionRows.map((s) => s.id);
  const entryRows = sectionIds.length
    ? await db.select().from(contentEntries).where(inArray(contentEntries.sectionId, sectionIds))
    : [];

  const contentBySectionId = new Map<string, Record<string, unknown>>();
  for (const entry of entryRows) {
    const bucket = contentBySectionId.get(entry.sectionId) ?? {};
    bucket[entry.key] = entry.value;
    contentBySectionId.set(entry.sectionId, bucket);
  }

  return {
    site: { id: siteRow.id, theme: siteRow.theme, templateId: siteRow.templateId },
    page: { id: pageRow.id, slug: pageRow.slug },
    sections: sectionRows.map((s) => ({
      id: s.id,
      sectionType: s.sectionType,
      order: s.order,
      content: contentBySectionId.get(s.id) ?? {},
    })),
  };
}

export type EditableSectionEntry = {
  id: string;
  sectionType: string;
  fields: Array<{ key: string; value: string }>;
};

/**
 * エディタ画面用: site配下の全pageのsectionsを横断取得する（仮説#3・編集境界プロトタイプ）。
 * content_entries は文字列値のみ編集可能フィールドとして返す
 * （配列/オブジェクト値の編集はスコープ外。src/lib/validation/content.ts が受け付ける型と一致させる）。
 */
export async function getEditableSiteSections(siteId: string): Promise<EditableSectionEntry[]> {
  const pageRows = await db.select({ id: pages.id }).from(pages).where(eq(pages.siteId, siteId));
  const pageIds = pageRows.map((p) => p.id);
  if (pageIds.length === 0) return [];

  const sectionRows = await db
    .select()
    .from(sections)
    .where(inArray(sections.pageId, pageIds))
    .orderBy(asc(sections.order));

  const sectionIds = sectionRows.map((s) => s.id);
  const entryRows = sectionIds.length
    ? await db.select().from(contentEntries).where(inArray(contentEntries.sectionId, sectionIds))
    : [];

  const fieldsBySectionId = new Map<string, Array<{ key: string; value: string }>>();
  for (const entry of entryRows) {
    if (typeof entry.value !== 'string') continue;
    const bucket = fieldsBySectionId.get(entry.sectionId) ?? [];
    bucket.push({ key: entry.key, value: entry.value });
    fieldsBySectionId.set(entry.sectionId, bucket);
  }

  return sectionRows.map((s) => ({
    id: s.id,
    sectionType: s.sectionType,
    fields: fieldsBySectionId.get(s.id) ?? [],
  }));
}
