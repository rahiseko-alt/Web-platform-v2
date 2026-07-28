/**
 * 生成された GeneratedPage を、そのユーザーの所有物として DB へ書き込む（ロードマップ B-2-a）。
 *
 * 責務の線引き:
 * - ここが持つ  : 所有者の organization の確保 / sites・pages・sections・content_entries への書き込み
 * - ここが持たない: LLM 呼び出し・生成（src/generate/create-page.ts が単一経路・F-4）、
 *                   画面表示（各入口の仕事）、一覧の取得（user-sites.ts）
 *
 * 所有の主体判定は api-guard.ts と同じ **organizations.createdBy === userId** に合わせる。
 * ここだけ別方式（例: sites.createdBy 単独）にすると、A-4 で確認済みの所有権判定と
 * 二重定義になり、片方だけ直すと IDOR が復活する。
 *
 * 書き込み順序は NOT NULL 制約（created_by / organization_id / site_id / page_id）を満たすため
 * organizations -> sites -> pages -> sections -> content_entries に固定する（seed/index.ts と同じ）。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { contentEntries, organizations, pages, sections, sites } from '@/db/schema';
import type { GeneratedPage } from '@/generate/types';

/**
 * 生成サイトの templateId。テンプレ由来ではない（LLM がその場で決めた一点物）ことを表す番兵。
 * `getDesignSpec()` はこれを知らないので undefined を返すが、design は sites.design 側に
 * 保存してあるので描画は成立する（site-render.ts が sites.design を優先して返す）。
 */
export const GENERATED_TEMPLATE_ID = 'generated';

/** 生成サイトの唯一のページ。preview の optional catch-all は空 slug を '/' に畳むのでそれに合わせる。 */
export const GENERATED_PAGE_SLUG = '/';

/** 一覧に出す表示名の最大長。長い依頼文をそのまま名前にすると一覧が読めなくなる。 */
const NAME_MAX_LENGTH = 60;

export interface SaveGeneratedPageInput {
  /** 所有者。セッションから取った実体のユーザーID（requireSession の戻り値）を渡すこと */
  userId: string;
  /** このサイトを生んだ依頼文 */
  brief: string;
  page: GeneratedPage;
}

export interface SaveGeneratedPageResult {
  siteId: string;
  pageId: string;
  organizationId: string;
}

/** 依頼文から一覧用の表示名を作る。改行・連続空白を潰して1行に畳む。 */
export function siteNameFromBrief(brief: string): string {
  const flat = brief.replace(/\s+/g, ' ').trim();
  if (!flat) return '無題のサイト';
  return flat.length > NAME_MAX_LENGTH ? `${flat.slice(0, NAME_MAX_LENGTH)}…` : flat;
}

/**
 * そのユーザーが所有する organization を1つ確保する（無ければ作る）。
 * organizations にメンバー中間テーブルが無い現設計では「作った人＝所有者」なので、
 * createdBy 一致で引ければ再利用してよい（docs/design-notes.md §9・api-guard.ts と同じ前提）。
 */
async function ensureOrganizationFor(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.createdBy, userId), eq(organizations.status, 'active')))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(organizations)
    .values({ name: 'My workspace', createdBy: userId })
    .returning({ id: organizations.id });
  if (!created) throw new Error('saveGeneratedPage: failed to create organization');
  return created.id;
}

/**
 * 生成結果を1サイトとして保存する。戻り値の siteId で /editor/[siteId]・/preview/[siteId] へ辿れる。
 *
 * 失敗は握りつぶさず投げる。呼び出し側（入口）が「保存に失敗した」ことを利用者へ出せるようにするため、
 * 保存できなかったのに成功した画面を見せる状態を作らない。
 */
export async function saveGeneratedPage(
  input: SaveGeneratedPageInput,
): Promise<SaveGeneratedPageResult> {
  const { userId, brief, page } = input;

  const organizationId = await ensureOrganizationFor(userId);

  const [site] = await db
    .insert(sites)
    .values({
      organizationId,
      name: siteNameFromBrief(brief),
      templateId: GENERATED_TEMPLATE_ID,
      theme: page.theme,
      palette: page.palette,
      motion: page.motion,
      design: page.design,
      brief,
      createdBy: userId,
    })
    .returning({ id: sites.id });
  if (!site) throw new Error('saveGeneratedPage: failed to insert site');

  const [pageRow] = await db
    .insert(pages)
    .values({
      organizationId,
      siteId: site.id,
      slug: GENERATED_PAGE_SLUG,
      createdBy: userId,
    })
    .returning({ id: pages.id });
  if (!pageRow) throw new Error('saveGeneratedPage: failed to insert page');

  for (const [index, section] of page.sections.entries()) {
    const [sectionRow] = await db
      .insert(sections)
      .values({
        organizationId,
        siteId: site.id,
        pageId: pageRow.id,
        sectionType: section.sectionType,
        // 生成結果の並び順は section.order ではなく配列順を正とする。
        // sections_page_order_unique（page_id, order）があるため、LLM 由来の order が
        // 重複していると保存が落ちる。配列順なら必ず 0..n-1 で一意になる。
        order: index,
        createdBy: userId,
      })
      .returning({ id: sections.id });
    if (!sectionRow) throw new Error(`saveGeneratedPage: failed to insert section ${section.sectionType}`);

    for (const [key, value] of Object.entries(section.content)) {
      // undefined は jsonb へ入れられない（NOT NULL 違反になる）ので落とす。
      if (value === undefined) continue;
      await db.insert(contentEntries).values({
        organizationId,
        siteId: site.id,
        sectionId: sectionRow.id,
        key,
        value,
        createdBy: userId,
      });
    }
  }

  return { siteId: site.id, pageId: pageRow.id, organizationId };
}
