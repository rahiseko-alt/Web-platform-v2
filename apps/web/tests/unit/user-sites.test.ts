import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
// eq は純粋な式ビルダーで接続の副作用が無いため、トップレベル import してよい
// （接続を張るのは @/db だけなので、そちらだけを動的 import する）。
import { eq } from 'drizzle-orm';

/**
 * 保存（B-2-a）と「自分のサイト一覧」（B-2-b / B-2-c）を **実SQL** で検証する。
 *
 * なぜモックではなく実DBか:
 *   一覧の隔離（B-2-c）が破れる典型は「WHERE から所有者条件が落ちる」ことで、これは SQL が
 *   実際に走らないと分からない。db をモックすると、モックが返す配列を検証するだけになり
 *   隔離が壊れても緑のままになる（＝偽の緑）。
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
let siteNameFromBrief: typeof import('@/db/queries/save-generated-page').siteNameFromBrief;
let listSitesForUser: typeof import('@/db/queries/user-sites').listSitesForUser;
let getRenderablePage: typeof import('@/db/queries/site-render').getRenderablePage;

/** 生成結果の最小形。sections の中身は content_entries へ縦持ちされる。 */
function generatedPage(overrides: Partial<import('@/generate/types').GeneratedPage> = {}) {
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
      { id: 'ignored-1', sectionType: 'hero-01', order: 0, content: { title: 'ヒーロー見出し', body: '本文' } },
      { id: 'ignored-2', sectionType: 'about-01', order: 1, content: { title: '私たちについて' } },
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

beforeAll(async () => {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  ({ saveGeneratedPage, siteNameFromBrief } = await import('@/db/queries/save-generated-page'));
  ({ listSitesForUser } = await import('@/db/queries/user-sites'));
  ({ getRenderablePage } = await import('@/db/queries/site-render'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: './drizzle' });
});

describe('siteNameFromBrief（一覧の表示名）', () => {
  it('改行や連続空白を1行へ畳む', () => {
    expect(siteNameFromBrief('渋谷の\n\nコーヒー   スタンド')).toBe('渋谷の コーヒー スタンド');
  });

  it('長い依頼文は切り詰める（一覧が読めなくならないように）', () => {
    const name = siteNameFromBrief('あ'.repeat(200));
    expect(name.length).toBeLessThanOrEqual(61); // 60文字 + 省略記号
    expect(name.endsWith('…')).toBe(true);
  });

  it('空の依頼文でも名前は必ず付く（sites.name は NOT NULL）', () => {
    expect(siteNameFromBrief('   ')).toBe('無題のサイト');
  });
});

describe('saveGeneratedPage（B-2-a: 自分の持ち物としてDBに残る）', () => {
  it('生成結果が site / page / sections / content_entries として保存される', async () => {
    const userId = await createUser('save-owner@example.com');
    const page = generatedPage();

    const saved = await saveGeneratedPage({ userId, brief: '渋谷のコーヒースタンド', page });

    // 所有者は organizations.createdBy（api-guard.ts と同じ判定方式）
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, saved.organizationId));
    expect(org?.createdBy).toBe(userId);

    // デザインの一点物（templateId から引けない情報）まで保存されている
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, saved.siteId));
    expect(site?.theme).toBe('modern');
    expect(site?.palette).toBe('forest');
    expect(site?.motion).toBe('lively');
    expect(site?.design).toEqual(page.design);
    expect(site?.brief).toBe('渋谷のコーヒースタンド');

    // 中身（セクションと文言）まで保存されている
    const rendered = await getRenderablePage(saved.siteId, '/');
    expect(rendered).not.toBeNull();
    expect(rendered?.sections.map((s) => s.sectionType)).toEqual(['hero-01', 'about-01']);
    expect(rendered?.sections[0]?.content).toEqual({ title: 'ヒーロー見出し', body: '本文' });
    // 保存した design が読み出し側にも戻る（戻らないと保存したLPが既定変種の別物として描画される）
    expect(rendered?.site.design).toEqual(page.design);
    expect(rendered?.site.palette).toBe('forest');
  });

  it('同じユーザーが2回生成しても organization は増えず、サイトだけ増える', async () => {
    const userId = await createUser('twice@example.com');
    const first = await saveGeneratedPage({ userId, brief: '1本目', page: generatedPage() });
    const second = await saveGeneratedPage({ userId, brief: '2本目', page: generatedPage() });

    expect(second.organizationId).toBe(first.organizationId);
    expect(second.siteId).not.toBe(first.siteId);
  });

  it('LLM 由来の order が重複していても保存できる（配列順を正にする）', async () => {
    const userId = await createUser('dup-order@example.com');
    // sections_page_order_unique(page_id, order) があるので、order をそのまま使うと落ちる
    const page = generatedPage({
      sections: [
        { id: 'a', sectionType: 'hero-01', order: 0, content: { title: 'A' } },
        { id: 'b', sectionType: 'about-01', order: 0, content: { title: 'B' } },
      ],
    });

    const saved = await saveGeneratedPage({ userId, brief: '順序重複', page });
    const rendered = await getRenderablePage(saved.siteId, '/');
    expect(rendered?.sections.map((s) => s.order)).toEqual([0, 1]);
    expect(rendered?.sections.map((s) => s.content.title)).toEqual(['A', 'B']);
  });
});

describe('listSitesForUser（B-2-b: 自分のが出る / B-2-c: 他人のは出ない）', () => {
  it('自分が生成したサイトが一覧に出る', async () => {
    const userId = await createUser('list-own@example.com');
    const saved = await saveGeneratedPage({ userId, brief: 'わたしのサイト', page: generatedPage() });

    const list = await listSitesForUser(userId);
    expect(list.map((s) => s.id)).toContain(saved.siteId);
    expect(list.find((s) => s.id === saved.siteId)?.brief).toBe('わたしのサイト');
  });

  it('他人が生成したサイトは自分の一覧に出ない（対照つき：相手の一覧にはちゃんと出る）', async () => {
    const alice = await createUser('alice-list@example.com');
    const bob = await createUser('bob-list@example.com');

    const aliceSite = await saveGeneratedPage({ userId: alice, brief: 'アリスのサイト', page: generatedPage() });

    const bobList = await listSitesForUser(bob);
    expect(bobList.map((s) => s.id)).not.toContain(aliceSite.siteId);
    // 「常に空を返す実装」でも上の1行は緑になるので、対照としてアリス側には出ることを要求する
    const aliceList = await listSitesForUser(alice);
    expect(aliceList.map((s) => s.id)).toContain(aliceSite.siteId);
  });

  it('1件も持たないユーザーの一覧は空（他人の分が漏れてこない）', async () => {
    const loner = await createUser('loner@example.com');
    await expect(listSitesForUser(loner)).resolves.toEqual([]);
  });
});

/**
 * 構造ガード：保存の呼び出しが入口から消えていないこと。
 * 上の実SQLテストは save/list 関数**単体**の正しさしか見ないので、これが無いと
 * app/generate/page.tsx が saveGeneratedPage を呼ばなくなっても緑のままになる
 * （＝生成はできるが何も残らない状態が CI をすり抜ける）。
 */
describe('生成の入口が保存を呼んでいる（B-2-a の接続が切れない）', () => {
  const GENERATE_PAGE = path.join(__dirname, '..', '..', 'app', 'generate', 'page.tsx');

  it('app/generate/page.tsx が saveGeneratedPage を呼ぶ', () => {
    const source = readFileSync(GENERATE_PAGE, 'utf-8');
    expect(source).toMatch(/from ['"]@\/db\/queries\/save-generated-page['"]/);
    expect(source).toMatch(/saveGeneratedPage\(/);
  });

  it('一覧ページが所有者で絞る関数を経由する（自前の絞り込みを書かない）', () => {
    const source = readFileSync(path.join(__dirname, '..', '..', 'app', 'editor', 'page.tsx'), 'utf-8');
    expect(source).toMatch(/from ['"]@\/db\/queries\/user-sites['"]/);
    // 一覧ページが sites テーブルを直接引き始めたら、絞り込みが2箇所へ散る
    expect(source).not.toMatch(/from ['"]@\/db['"]/);
  });
});
