import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
// eq / and は純粋な式ビルダーで接続の副作用が無いため、トップレベル import してよい
// （接続を張るのは @/db だけなので、そちらだけを動的 import する）。
import { and, eq } from 'drizzle-orm';

/**
 * C-1（依頼文を直して再生成すると、同じサイトのまま置き換わる）の**上書き手順**を実SQLで検証する。
 *
 * なぜモックではなく実DBか（user-sites.test.ts と同じ理由）:
 *   上書きの壊れ方は「古いセクションが消えずに残る」「外部キー違反で落ちる」「新しいサイトが増える」
 *   のように SQL が実際に走らないと分からないものばかり。db をモックすると呼び出し回数を数えるだけの
 *   テストになり、上書きが壊れても緑のままになる（＝偽の緑）。
 *
 * ここが見るのは**手順の正しさ**だけ。受入（実UIで言い直して同じサイトが置き換わる／他人のサイトは
 * 拒否される）は c1-regenerate-smoke.yml の CI run が判定する（C-1 / C-1-b の evidence）。
 *
 * DB は **プロセス内の使い捨て PGlite**（memory://）。開発用の ./.pglite を汚さない。
 * src/db/index.ts は import 時に PGLITE_DATA_DIR を読むので、**動的 import より前に**環境変数を張る。
 */

process.env.PGLITE_DATA_DIR = 'memory://';
delete process.env.DATABASE_URL;

type Schema = typeof import('@/db/schema');

let db: typeof import('@/db').db;
let schema: Schema;
let saveGeneratedPage: typeof import('@/db/queries/save-generated-page').saveGeneratedPage;
let updateGeneratedPage: typeof import('@/db/queries/save-generated-page').updateGeneratedPage;
let listSitesForUser: typeof import('@/db/queries/user-sites').listSitesForUser;
let getRenderablePage: typeof import('@/db/queries/site-render').getRenderablePage;

/** 生成結果の最小形。文言に目印を混ぜて「置き換わったか」を言い切れるようにする。 */
function generatedPage(
  marker: string,
  overrides: Partial<import('@/generate/types').GeneratedPage> = {},
) {
  return {
    design: {
      heroVariant: 'split-editorial' as const,
      rhythm: 'loose' as const,
      align: 'asymmetric' as const,
      sectionVariants: { 'hero-01': 'b' },
      cardStyle: 'soft' as const,
      buttonShape: 'pill' as const,
    },
    theme: 'modern',
    palette: 'forest',
    motion: 'lively',
    sections: [
      { id: 'ignored-1', sectionType: 'hero-01', order: 0, content: { title: `${marker}の見出し`, body: '本文' } },
      { id: 'ignored-2', sectionType: 'about-01', order: 1, content: { title: `${marker}について` } },
    ],
    needsReview: false,
    unknowns: [],
    ...overrides,
  };
}

async function createUser(email: string): Promise<string> {
  const [row] = await db.insert(schema.users).values({ name: email, email }).returning({ id: schema.users.id });
  if (!row) throw new Error(`failed to create user ${email}`);
  return row.id;
}

/** 保存済みサイトから、requireSiteOwnership が返すのと同じ形の「検証済み所有権」を作る。 */
async function ownershipFor(userId: string, siteId: string) {
  const [row] = await db
    .select({ organizationId: schema.sites.organizationId })
    .from(schema.sites)
    .where(eq(schema.sites.id, siteId))
    .limit(1);
  if (!row) throw new Error(`site ${siteId} not found`);
  return { userId, organizationId: row.organizationId, siteId };
}

/** そのサイトに保存されている全文言を1本の文字列に畳む（目印の有無を見るため）。 */
async function storedTextOf(siteId: string): Promise<string> {
  const rows = await db
    .select({ value: schema.contentEntries.value })
    .from(schema.contentEntries)
    .where(eq(schema.contentEntries.siteId, siteId));
  return rows.map((row) => JSON.stringify(row.value)).join('\n');
}

beforeAll(async () => {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  ({ saveGeneratedPage, updateGeneratedPage } = await import('@/db/queries/save-generated-page'));
  ({ listSitesForUser } = await import('@/db/queries/user-sites'));
  ({ getRenderablePage } = await import('@/db/queries/site-render'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: './drizzle' });
});

describe('updateGeneratedPage（C-1: 言い直しで同じサイトが置き換わる）', () => {
  it('サイトは増えず、同じ siteId のまま中身が置き換わる', async () => {
    const userId = await createUser('c1-overwrite@example.com');
    const first = await saveGeneratedPage({
      userId,
      brief: 'MARKA という喫茶店のサイト',
      page: generatedPage('MARKA'),
    });

    const ownership = await ownershipFor(userId, first.siteId);
    const second = await updateGeneratedPage({
      ownership,
      brief: 'MARKB という喫茶店のサイト',
      page: generatedPage('MARKB'),
    });

    // 新しいサイトが増えていない（＝一覧に失敗作が溜まらない）
    expect(second.siteId).toBe(first.siteId);
    expect(second.organizationId).toBe(first.organizationId);
    const list = await listSitesForUser(userId);
    expect(list.map((site) => site.id)).toEqual([first.siteId]);

    // 中身は新しい方に入れ替わり、古い方は残っていない
    const text = await storedTextOf(first.siteId);
    expect(text).toContain('MARKB');
    expect(text).not.toContain('MARKA');

    // 一覧の表示名と依頼文も新しい方になっている
    expect(list[0]?.brief).toBe('MARKB という喫茶店のサイト');
    expect(list[0]?.name).toContain('MARKB');
  });

  it('ページ（公開URLの宛先）は作り直さず再利用する', async () => {
    const userId = await createUser('c1-page-reuse@example.com');
    const first = await saveGeneratedPage({ userId, brief: '1回目', page: generatedPage('P1') });

    const second = await updateGeneratedPage({
      ownership: await ownershipFor(userId, first.siteId),
      brief: '2回目',
      page: generatedPage('P2'),
    });

    // pageId が変わると、既に配ってしまった公開URLの宛先が変わる
    expect(second.pageId).toBe(first.pageId);
    const pageRows = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.siteId, first.siteId));
    expect(pageRows).toHaveLength(1);
  });

  it('見た目（テーマ・配色・動き・design）も新しい生成結果へ差し替わる', async () => {
    const userId = await createUser('c1-design@example.com');
    const first = await saveGeneratedPage({ userId, brief: '見た目1', page: generatedPage('D1') });

    await updateGeneratedPage({
      ownership: await ownershipFor(userId, first.siteId),
      brief: '見た目2',
      page: generatedPage('D2', {
        theme: 'classic',
        palette: 'sunset',
        motion: 'calm',
        design: {
          heroVariant: 'typographic-kinetic',
          rhythm: 'tight',
          align: 'centered',
          sectionVariants: { 'hero-01': 'a' },
          cardStyle: 'bold',
          buttonShape: 'rounded',
        },
      }),
    });

    const rendered = await getRenderablePage(first.siteId, '/');
    expect(rendered?.site.theme).toBe('classic');
    expect(rendered?.site.palette).toBe('sunset');
    expect(rendered?.site.motion).toBe('calm');
    expect(rendered?.site.design).toMatchObject({ heroVariant: 'typographic-kinetic', rhythm: 'tight' });
  });

  it('置き換え後もセクションの並びは配列順（0..n-1）で、LLM 由来の order 重複でも落ちない', async () => {
    const userId = await createUser('c1-order@example.com');
    const first = await saveGeneratedPage({ userId, brief: '順序1', page: generatedPage('O1') });

    await updateGeneratedPage({
      ownership: await ownershipFor(userId, first.siteId),
      brief: '順序2',
      page: generatedPage('O2', {
        sections: [
          { id: 'a', sectionType: 'hero-01', order: 0, content: { title: 'O2-A' } },
          { id: 'b', sectionType: 'about-01', order: 0, content: { title: 'O2-B' } },
          { id: 'c', sectionType: 'contact-01', order: 0, content: { title: 'O2-C' } },
        ],
      }),
    });

    const rendered = await getRenderablePage(first.siteId, '/');
    expect(rendered?.sections.map((section) => section.order)).toEqual([0, 1, 2]);
    expect(rendered?.sections.map((section) => section.content.title)).toEqual(['O2-A', 'O2-B', 'O2-C']);
  });

  it('言い直しを3回繰り返しても、一覧に残るのは1件だけ（失敗作が溜まらない）', async () => {
    const userId = await createUser('c1-three-times@example.com');
    const first = await saveGeneratedPage({ userId, brief: '1回目', page: generatedPage('T1') });

    for (const round of ['T2', 'T3', 'T4']) {
      await updateGeneratedPage({
        ownership: await ownershipFor(userId, first.siteId),
        brief: `${round} の依頼文`,
        page: generatedPage(round),
      });
    }

    const list = await listSitesForUser(userId);
    expect(list.map((site) => site.id)).toEqual([first.siteId]);
    const text = await storedTextOf(first.siteId);
    expect(text).toContain('T4');
    for (const stale of ['T1', 'T2', 'T3']) {
      expect(text).not.toContain(stale);
    }
  });

  it('他人のサイトは、そもそも「検証済み所有権」を作れない（organizations.createdBy 一致で引けない）', async () => {
    const alice = await createUser('c1-alice@example.com');
    const bob = await createUser('c1-bob@example.com');
    const aliceSite = await saveGeneratedPage({ userId: alice, brief: 'アリスのサイト', page: generatedPage('ALICE') });

    // requireSiteOwnership と同じ判定（organizations.createdBy 一致）を実SQLで確認する。
    // 型の上でも siteId 単体では updateGeneratedPage を呼べない（VerifiedSiteOwnership が要る）が、
    // その型が守っている実体の条件——bob では aliceSite を引けないこと——をここで裏取りする。
    const rows = await db
      .select({ id: schema.sites.id })
      .from(schema.sites)
      .innerJoin(schema.organizations, eq(schema.sites.organizationId, schema.organizations.id))
      .where(and(eq(schema.sites.id, aliceSite.siteId), eq(schema.organizations.createdBy, bob)));
    expect(rows).toEqual([]);

    // 対照：アリス自身では引ける（常に空を返すクエリで緑になっていないことの確認）
    const own = await db
      .select({ id: schema.sites.id })
      .from(schema.sites)
      .innerJoin(schema.organizations, eq(schema.sites.organizationId, schema.organizations.id))
      .where(and(eq(schema.sites.id, aliceSite.siteId), eq(schema.organizations.createdBy, alice)));
    expect(own.map((row) => row.id)).toEqual([aliceSite.siteId]);
  });
});

/**
 * 構造ガード：入口が上書き経路と所有権チェックを繋いだままであること。
 * 上の実SQLテストは updateGeneratedPage **単体**の正しさしか見ないので、これが無いと
 * app/generate/page.tsx が上書きを呼ばなくなっても（＝言い直しで新しいサイトが増えるようになっても）、
 * また所有権チェックを外しても緑のままになる。
 */
describe('生成の入口が上書きと所有権チェックを繋いでいる（C-1 / C-1-b の接続が切れない）', () => {
  const GENERATE_PAGE = path.join(__dirname, '..', '..', 'app', 'generate', 'page.tsx');
  const source = () => readFileSync(GENERATE_PAGE, 'utf-8');

  it('siteId を hidden field で持ち回す（クエリ直書きに頼らない送信経路）', () => {
    expect(source()).toMatch(/type="hidden"[\s\S]{0,80}name="siteId"/);
  });

  it('上書き経路（updateGeneratedPage）を呼ぶ', () => {
    expect(source()).toMatch(/from ['"]@\/db\/queries\/save-generated-page['"]/);
    expect(source()).toMatch(/updateGeneratedPage\(/);
  });

  it('所有権は api-guard の requireSiteOwnership で判定する（自前の判定を書かない）', () => {
    const text = source();
    expect(text).toMatch(/requireSiteOwnership\(/);
    // 入口が sites/organizations を直接引き始めたら、所有権の判定方式が2箇所へ散る
    expect(text).not.toMatch(/from ['"]@\/db\/schema['"]/);
  });

  it('所有権チェックは生成より前に走る（他人のサイト狙いの送信で LLM 課金を発生させない）', () => {
    const text = source();
    // 実際の呼び出し（await 付き）だけを見る。説明コメント中の `createPageFromBrief()` のような
    // 言及を数えると、コメントを書き足しただけで順序判定が壊れる。
    const guardAt = text.indexOf('await requireSiteOwnership(');
    const generateAt = text.indexOf('await createPageFromBrief(');
    expect(guardAt, '入口が requireSiteOwnership を await で呼んでいない').toBeGreaterThan(-1);
    expect(generateAt, '入口が createPageFromBrief を await で呼んでいない').toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(generateAt);
  });
});
