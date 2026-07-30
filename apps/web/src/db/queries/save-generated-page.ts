/**
 * 生成された GeneratedPage を、そのユーザーの所有物として DB へ書き込む。
 *
 * 2つの経路を持つ:
 * - `saveGeneratedPage()`   : 新しいサイトとして作る（ロードマップ B-2-a）
 * - `updateGeneratedPage()` : 既存サイトの中身を入れ替える（ロードマップ C-1 の「言い直し」）
 *
 * **同じファイルに置いている理由**：書き込み順序の知識（NOT NULL 制約と
 * sections_page_order_unique を満たす並び）を1箇所に閉じるため。別ファイルへ分けると同じ順序が
 * 2箇所に複製され、片方だけ直したときに壊れる（ロードマップ F の火種そのもの）。
 *
 * 責務の線引き:
 * - ここが持つ  : 所有者の organization の確保 / sites・pages・sections・content_entries への書き込み
 * - ここが持たない: LLM 呼び出し・生成（src/generate/create-page.ts が単一経路・F-4）、
 *                   画面表示（各入口の仕事）、一覧の取得（user-sites.ts）、
 *                   **所有権の判定**（lib/api-guard.ts が唯一の判定所。下記 VerifiedSiteOwnership 参照）
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
 * 書き込み先。`db` そのものと、`db.transaction()` が渡すトランザクションの
 * どちらも受けられるようにするための最小の面。
 */
type Writer = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

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

/** sites 行に書く「生成されたLPの見た目と由来」。新規作成と上書きで同じ値を書くため関数に閉じる。 */
function siteValuesFor(brief: string, page: GeneratedPage) {
  return {
    name: siteNameFromBrief(brief),
    templateId: GENERATED_TEMPLATE_ID,
    theme: page.theme,
    palette: page.palette,
    motion: page.motion,
    design: page.design,
    brief,
    // 機械採点の独立再計算（B-3-a）に要る。無いと scoreHonesty が常に unknowns=[] を
    // 見ることになり、表示側と再計算側が同じ誤値で一致してしまう。
    unknowns: page.unknowns,
    needsReview: page.needsReview,
  };
}

/**
 * セクションと文言を書き込む。**呼ぶ前に対象ページのセクションが空であること**が前提
 * （sections_page_order_unique（page_id, order）があるため、残っていると衝突する）。
 */
async function writeSections(
  writer: Writer,
  args: { organizationId: string; siteId: string; pageId: string; userId: string; page: GeneratedPage },
): Promise<void> {
  const { organizationId, siteId, pageId, userId, page } = args;

  for (const [index, section] of page.sections.entries()) {
    const [sectionRow] = await writer
      .insert(sections)
      .values({
        organizationId,
        siteId,
        pageId,
        sectionType: section.sectionType,
        // 生成結果の並び順は section.order ではなく配列順を正とする。
        // sections_page_order_unique（page_id, order）があるため、LLM 由来の order が
        // 重複していると保存が落ちる。配列順なら必ず 0..n-1 で一意になる。
        order: index,
        createdBy: userId,
      })
      .returning({ id: sections.id });
    if (!sectionRow) throw new Error(`failed to insert section ${section.sectionType}`);

    for (const [key, value] of Object.entries(section.content)) {
      // undefined は jsonb へ入れられない（NOT NULL 違反になる）ので落とす。
      if (value === undefined) continue;
      await writer.insert(contentEntries).values({
        organizationId,
        siteId,
        sectionId: sectionRow.id,
        key,
        value,
        createdBy: userId,
      });
    }
  }
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
    .values({ ...siteValuesFor(brief, page), organizationId, createdBy: userId })
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

  await writeSections(db, {
    organizationId,
    siteId: site.id,
    pageId: pageRow.id,
    userId,
    page,
  });

  return { siteId: site.id, pageId: pageRow.id, organizationId };
}

/**
 * 「所有権の検証を通した」ことを型で要求するための印（ロードマップ C-1-b）。
 *
 * **この値は `lib/api-guard.ts` の `requireSiteOwnership()` の成功結果からのみ作ること。**
 * 引数をこの形にしているのは、上書き経路の呼び出し側が所有権チェックを飛ばせないようにするため。
 * siteId を素の string で受けると「hidden field で送られてきた他人の siteId をそのまま渡す」
 * 実装が型検査を通ってしまい、C-1-b（他人のサイトを言い直しで書き換えられない）が破れる。
 */
export interface VerifiedSiteOwnership {
  userId: string;
  organizationId: string;
  siteId: string;
}

export interface UpdateGeneratedPageInput {
  /** `requireSiteOwnership()` が ok を返した結果をそのまま渡す */
  ownership: VerifiedSiteOwnership;
  /** 言い直した後の依頼文 */
  brief: string;
  page: GeneratedPage;
}

/**
 * 既存サイトの中身を、言い直しで作り直した生成結果へ入れ替える（ロードマップ C-1）。
 *
 * なぜ新規INSERTではなく上書きか（マスター決定・C-1 の detail が正）:
 *   言い直しは「同じ結果を見ながらの訂正」なので、3回言い直した利用者の一覧に
 *   失敗作が2件残り続ける状態にしない。B-2-b-2 が守る「2件目を作っても1件目が消えない」は
 *   一覧から都度『新しく作る』互いに無関係な生成のことで、こちらとは別の操作。
 *
 * トランザクションで包む理由: 入れ替えは「消してから書く」ので、途中で落ちると
 * **中身が空のサイト**が残る。新規INSERT（saveGeneratedPage）と違い、失敗が既存の資産を壊す。
 */
export async function updateGeneratedPage(
  input: UpdateGeneratedPageInput,
): Promise<SaveGeneratedPageResult> {
  const { ownership, brief, page } = input;
  const { userId, organizationId, siteId } = ownership;

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(sites)
      .set({ ...siteValuesFor(brief, page), updatedAt: new Date() })
      .where(eq(sites.id, siteId))
      .returning({ id: sites.id });
    if (updated.length === 0) throw new Error('updateGeneratedPage: site not found');

    // 中身を入れ替える。content_entries -> sections の順で消す（content_entries が
    // sections を参照しているので逆順だと外部キー違反になる）。
    await tx.delete(contentEntries).where(eq(contentEntries.siteId, siteId));
    await tx.delete(sections).where(eq(sections.siteId, siteId));

    // 生成されたサイトのページは '/' の1枚だけ（GENERATED_PAGE_SLUG）。
    // 消さずに再利用する: /preview/[siteId] や外から張られたリンクの宛先を変えないため。
    const [existingPage] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.slug, GENERATED_PAGE_SLUG)))
      .limit(1);

    let pageId = existingPage?.id;
    if (!pageId) {
      // テンプレ由来のサイトなど '/' を持たないサイトを言い直しの宛先にした場合に備える。
      const [created] = await tx
        .insert(pages)
        .values({ organizationId, siteId, slug: GENERATED_PAGE_SLUG, createdBy: userId })
        .returning({ id: pages.id });
      if (!created) throw new Error('updateGeneratedPage: failed to insert page');
      pageId = created.id;
    }

    await writeSections(tx, { organizationId, siteId, pageId, userId, page });

    return { siteId, pageId, organizationId };
  });
}
