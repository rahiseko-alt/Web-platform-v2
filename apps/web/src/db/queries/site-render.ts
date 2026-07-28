import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { contentEntries, pages, sections, sites } from '@/db/schema';
import type { DesignSpec } from '@/templates/types';

export type RenderableSection = {
  id: string;
  sectionType: string;
  order: number;
  content: Record<string, unknown>;
};

export type RenderablePage = {
  site: {
    id: string;
    theme: string;
    templateId: string;
    /**
     * 以下3つは「生成されたサイト」（B-2-a）で保存された一点物のデザイン。テンプレ由来のサイトでは null。
     * 呼び出し側は design が null のときだけ templateId から getDesignSpec() で引く
     * （生成サイトは templateId を持たないため、これが無いと保存したLPが別物になって出る）。
     */
    palette: string | null;
    motion: string | null;
    design: DesignSpec | null;
    /** このサイトを生んだ依頼文。生成されたサイト（B-2-a）のみ。テンプレ由来は null */
    brief: string | null;
    /**
     * 以下2つは機械採点の独立再計算（B-3-a）用。生成されたサイトのみ。
     * LLM 出力をそのまま保存しているだけで、ここでの真偽判定は行わない。
     */
    unknowns: string[] | null;
    needsReview: boolean | null;
  };
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
    site: {
      id: siteRow.id,
      theme: siteRow.theme,
      templateId: siteRow.templateId,
      palette: siteRow.palette,
      motion: siteRow.motion,
      // jsonb は unknown で返る。形の検証は保存側（save-generated-page.ts が DesignSpec を書く）に
      // 委ね、ここでは読み出しの型付けだけを行う。
      design: (siteRow.design as DesignSpec | null) ?? null,
      brief: siteRow.brief,
      unknowns: siteRow.unknowns ?? null,
      needsReview: siteRow.needsReview,
    },
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
