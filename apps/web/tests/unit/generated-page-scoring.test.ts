import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';

/**
 * 機械採点の独立再計算（ロードマップ B-3-a）が使う復元関数 getGeneratedPageForScoring を
 * **実SQL** で検証する。
 *
 * なぜ実DBか：この関数の核心は「欠けを既定値で埋めない」こと。モックだと欠損を作れず、
 * 欠損時に本当に例外が飛ぶかを確認できない（B-2 の隔離バグと同じ理由でモックを避ける）。
 *
 * DB は user-sites.test.ts と同じくプロセス内の使い捨て PGlite（memory://）。
 */

process.env.PGLITE_DATA_DIR = 'memory://';
delete process.env.DATABASE_URL;

type Schema = typeof import('@/db/schema');

let db: typeof import('@/db').db;
let schema: Schema;
let saveGeneratedPage: typeof import('@/db/queries/save-generated-page').saveGeneratedPage;
let getGeneratedPageForScoring: typeof import('@/db/queries/generated-page').getGeneratedPageForScoring;
let scorePage: typeof import('@/eval/score').scorePage;

function generatedPage(overrides: Partial<import('@/generate/types').GeneratedPage> = {}) {
  return {
    design: {
      heroVariant: 'split-editorial' as const,
      rhythm: 'loose' as const,
      align: 'asymmetric' as const,
      sectionVariants: {},
      cardStyle: 'soft' as const,
      buttonShape: 'pill' as const,
    },
    theme: 'modern',
    palette: 'forest',
    motion: 'lively',
    sections: [
      { id: 'ignored-1', sectionType: 'hero-01', order: 0, content: { title: 'ヒーロー見出し' } },
      { id: 'ignored-2', sectionType: 'about-01', order: 1, content: { title: '私たちについて' } },
    ],
    needsReview: false,
    unknowns: [] as string[],
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
  ({ saveGeneratedPage } = await import('@/db/queries/save-generated-page'));
  ({ getGeneratedPageForScoring } = await import('@/db/queries/generated-page'));
  ({ scorePage } = await import('@/eval/score'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: './drizzle' });
});

describe('getGeneratedPageForScoring（B-3-a: 独立再計算の入力を復元する）', () => {
  it('保存した内容をそのまま復元し、直接採点した結果と一致する', async () => {
    const userId = await createUser('scoring-owner@example.com');
    const brief = '渋谷のネイルサロン（採点復元テスト専用）';
    const page = generatedPage();

    const saved = await saveGeneratedPage({ userId, brief, page });
    const reconstructed = await getGeneratedPageForScoring(saved.siteId);

    expect(reconstructed).not.toBeNull();
    expect(reconstructed?.brief).toBe(brief);
    expect(reconstructed?.page.unknowns).toEqual(page.unknowns);
    expect(reconstructed?.page.needsReview).toBe(page.needsReview);

    const direct = scorePage(brief, page);
    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);
    expect(recomputed).toEqual(direct);
  });

  it('unknowns の値が採点（誠実性）に実際に効くことを、復元経由でも確認する', async () => {
    const userId = await createUser('scoring-unknowns@example.com');
    const brief = '実績多数の老舗サロン';
    // unknowns に「資格・実績」を挙げているのに本文へ資格を書いている＝矛盾（scoreHonesty が検知する）
    const page = generatedPage({
      unknowns: ['資格'],
      sections: [
        {
          id: 'ignored-1',
          sectionType: 'about-01',
          order: 0,
          content: { title: '私たちについて', credentials: ['国家資格A'] },
        },
      ],
    });

    const saved = await saveGeneratedPage({ userId, brief, page });
    const reconstructed = await getGeneratedPageForScoring(saved.siteId);

    const direct = scorePage(brief, page);
    const recomputed = scorePage(reconstructed!.brief, reconstructed!.page);

    // 矛盾が検知され減点されていること（＝unknowns が実際に効いている）
    expect(direct.details.honesty.score).toBeLessThan(direct.details.honesty.max);
    // 復元経由でも同じ結果になること（既定値[]で埋めていたら、この矛盾は消えて満点になるはず）
    expect(recomputed).toEqual(direct);
  });

  it('unknowns / needsReview が欠けている（=null）行は、既定値で埋めず失敗する', async () => {
    const userId = await createUser('scoring-missing@example.com');
    const brief = '欠損データテスト';
    const page = generatedPage();
    const saved = await saveGeneratedPage({ userId, brief, page });

    // B-2以前の保存（unknowns/needsReview が無かった時代）を模して、直接 null へ戻す。
    await db.update(schema.sites).set({ unknowns: null, needsReview: null }).where(eq(schema.sites.id, saved.siteId));

    await expect(getGeneratedPageForScoring(saved.siteId)).rejects.toThrow(/unknowns/);
  });

  it('存在しない siteId は null を返す（例外にしない）', async () => {
    await expect(getGeneratedPageForScoring('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });
});
