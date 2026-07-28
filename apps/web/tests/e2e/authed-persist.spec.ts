import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * B-2: 生成されたLPが、そのユーザーの所有物として保存される — 受入検証。
 *
 * 4葉ぶんを1回の実行で見る（それぞれ独立した受入事実なので、失敗時にどれが赤かを判別できるよう
 * アサーション側にコメントで葉IDを書く）:
 *   B-2-a   : 作ったLPの中身が、その人のものとして保存先に残る
 *   B-2-b-1 : ログインした直後の画面が、エラーにならずに開く
 *   B-2-b-2 : 作ったサイトが自分のサイト一覧に並ぶ（2件目を作っても1件目が消えない）
 *   B-2-c   : 自分のサイト一覧に、他人のサイトは出ない
 *
 * **これは実際に OpenAI を呼ぶ（課金が発生する）テスト**なので、通常の `pnpm e2e` からは外し、
 * 専用ワークフロー（.github/workflows/b2-persist-smoke.yml）からのみ実行する。生成は3回走る
 * （A が2件・B が1件）。3回とも必要な理由:
 *   - A の2件目 : 「2件目を作ると1件目が消える」上書き実装を落とすため（B-2-b-2）
 *   - B の1件   : 一覧が壊れて誰にも何も出ない実装を落とす対照（B-2-c）と、
 *                 **A と同じ依頼文**を使うことで「他人が同じ依頼文を先に出していると保存されない」
 *                 実装を落とすため（B-2-a の(3)）
 *
 * B-2-a の判定はここでは完結しない。画面から見えるのは「画面に出た」ことだけで、
 * 稼働中プロセスのメモリを見せているのか保存先に残ったのかを区別できないため、
 * ここでは事実を .b2-result.json へ書き出すに留め、**サーバー停止後に別プロセス**で
 * scripts/verify-b2-persistence.mjs が保存先を直接読んで判定する。
 * 停止は「ワークフローのステップ分離＋Playwright の webServer 終了＋実行前の到達性チェック」で
 * 担保する（⚠ PGlite は同じ dataDir を稼働中でも別プロセスから開けるため、『読めたこと』は
 * 停止の証拠にならない。独立検証者が pglite 0.5.4 で実測済み）。
 */

const OUTPUT_PATH = path.join(__dirname, '.b2-result.json');
const PASSWORD = 'B2PersistVerify123!';
const GENERATE_TIMEOUT_MS = 180_000;

/** その回限りの目印。保存されたものが「いま作ったそれ」だと言い切るために使う。 */
function marker(label: string): string {
  return `Z${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();
}

function uniqueEmail(label: string): string {
  return `b2_${label}_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

function briefWith(mark: string): string {
  return `${mark} という名前の小さな喫茶店のサイト。落ち着いた雰囲気で、自家焙煎の豆と静かな時間を伝えたい。店名の ${mark} は必ず見出しに入れてください。`;
}

async function signUp(context: BrowserContext, email: string): Promise<void> {
  const response = await context.request.post('/api/auth/sign-up/email', {
    data: { email, password: PASSWORD, name: 'B2 E2E' },
  });
  expect(response.ok(), `sign-up failed: ${response.status()}`).toBe(true);
}

/**
 * 実際のログイン画面からログインする（API でトークンを取って差し込まない）。
 * B-2-b-1 の受入はこの「着地した画面」そのものなので、実フローで作らないと意味が無い。
 *
 * 先に cookie を捨てるのは、サインアップ（better-auth の autoSignIn が既定 true）が発行した
 * セッションを持ち越さないため。捨てないと、以降の /editor が「サインアップ由来のセッション」で
 * 通ってしまい、**ログインが壊れていても着地できる**ので B-2-b-1 の証明にならない。
 */
async function loginViaForm(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByPlaceholder('email').fill(email);
  await page.getByPlaceholder('password').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

type GenerateResult = { siteId: string; headline: string; sectionTypes: string[] };

/** 実際の送信UI（textarea → 生成ボタン）から依頼文を送り、保存された siteId と見出しを回収する。 */
async function generate(page: Page, brief: string): Promise<GenerateResult> {
  await page.goto('/generate');
  await page.getByPlaceholder('どんなサイトが欲しいか').fill(brief);
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('brief') === brief, { timeout: GENERATE_TIMEOUT_MS }),
    page.getByRole('button', { name: '生成' }).click(),
  ]);

  const result = page.locator('[data-generate-status="ok"]');
  await expect(result).toBeVisible({ timeout: GENERATE_TIMEOUT_MS });

  // キャッシュ再表示では受入としない。**実際にLLMを呼んだ**ことを要求する。
  // B が A と同じ依頼文を使う回では、ここが利用者間キャッシュ共有の検出器も兼ねる（B-2-a の(3)）。
  await expect(result).toHaveAttribute('data-generate-from-cache', 'false');

  // 保存された実体の ID。保存されていなければ属性ごと出ない＝ここで落ちる。
  const siteId = await result.getAttribute('data-saved-site-id');
  expect(siteId, '生成は成功したのに保存された siteId が画面に出ていない').toBeTruthy();

  // 同一性の照合材料：画面に実際に出ている見出しの文言。
  const headline = (await result.getByRole('heading').first().innerText()).trim();
  expect(headline.length, '見出しが空（枠だけ描画されている）').toBeGreaterThan(0);

  const sectionTypes = await page.locator('[data-section-type]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-section-type') ?? ''),
  );
  expect(sectionTypes.length, 'セクションが1つも描画されていない').toBeGreaterThan(0);

  return { siteId: siteId as string, headline, sectionTypes };
}

/**
 * 一覧に並んでいるサイトIDを読む。
 *
 * 一覧の <ul> は0件のとき中身が空＝高さ0で "hidden" 扱いになるので、可視性で待たない。
 * 「画面がちゃんと描画された（404やエラー画面ではない）」は可視要素を含む data-page で確かめ、
 * 一覧要素自体は DOM に在ること（toBeAttached）を確かめる。
 */
async function listedSiteIds(page: Page): Promise<string[]> {
  await page.goto('/editor');
  await expect(page.locator('[data-page="site-list-page"]')).toBeVisible();
  await expect(page.locator('[data-site-list="site-list"]')).toBeAttached();
  return page.locator('[data-site-id]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-site-id') ?? ''),
  );
}

test.describe('B-2: 生成されたLPが自分の所有物として保存される', () => {
  test.beforeAll(() => {
    // キーが無いのに「緑」に見える状態を作らない。未設定は**テストの失敗**として扱う。
    expect(
      process.env.OPENAI_API_KEY,
      'OPENAI_API_KEY が未設定です。このテストは実LLMでの受入検証なのでスキップせず落とします。',
    ).toBeTruthy();
  });

  test('未ログインで一覧へ行くとログイン画面へ誘導される（対照実験）', async ({ page }) => {
    // 「誰でも一覧が見られる」実装ではないことの対照。
    await page.goto('/editor');
    await expect(page).toHaveURL(/\/login/);
  });

  test('生成したLPが保存され、自分の一覧にだけ並ぶ', async ({ browser }) => {
    const markA1 = marker('A1');
    const markA2 = marker('A2');
    const briefA1 = briefWith(markA1);
    const briefA2 = briefWith(markA2);

    const emailA = uniqueEmail('a');
    const emailB = uniqueEmail('b');

    // ---- 利用者A ----
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUp(contextA, emailA);
    await loginViaForm(pageA, emailA);

    // B-2-b-1: ログイン直後の着地がエラー画面ではなく自分の作業画面である。
    // 一覧は0件＝<ul>が空で高さ0のため可視性では判定できない。実際に描画された画面であることは
    // 可視要素を含む data-page で、一覧の存在は toBeAttached で確かめる。
    expect(new URL(pageA.url()).pathname, 'ログイン後の着地点が想定と違う').toBe('/editor');
    await expect(
      pageA.locator('[data-page="site-list-page"]'),
      'ログイン直後の画面に自分のサイトの画面が出ていない（エラー画面の可能性）',
    ).toBeVisible();
    await expect(
      pageA.locator('[data-site-list="site-list"]'),
      '一覧そのものが描画されていない',
    ).toBeAttached();
    // 1件も作っていないので、この時点の一覧は空。あとで「増えた」と言えるようにする。
    await expect(pageA.locator('[data-site-list="site-list"]')).toHaveAttribute('data-site-count', '0');

    const a1 = await generate(pageA, briefA1);

    // B-2-b-2（前半）: 作ったサイトが一覧に並ぶ。
    expect(await listedSiteIds(pageA), '生成したサイトが一覧に並んでいない').toContain(a1.siteId);

    const a2 = await generate(pageA, briefA2);

    // B-2-b-2（後半）: 2件目を作っても1件目が消えない＝上書き実装を落とす。
    const listAfterTwo = await listedSiteIds(pageA);
    expect(listAfterTwo, '2件目を作ったら1件目が一覧から消えた（上書きされている）').toContain(a1.siteId);
    expect(listAfterTwo, '2件目が一覧に並んでいない').toContain(a2.siteId);

    // siteId が合っているだけでは「そのサイトが並んでいる」と言い切れない（IDは正しいが表示は
    // 別サイトの名前、という壊れ方を拾えない）。その回限りの目印が画面に出ていることまで見る。
    await expect(
      pageA.getByText(markA1, { exact: false }).first(),
      '1件目の目印が一覧に表示されていない',
    ).toBeVisible();
    await expect(
      pageA.getByText(markA2, { exact: false }).first(),
      '2件目の目印が一覧に表示されていない',
    ).toBeVisible();

    // ---- 利用者B（別ブラウザコンテキスト＝Aのセッションを引き継がない）----
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(contextB, emailB);
    await loginViaForm(pageB, emailB);

    // B-2-c（前半）: まだ1件も作っていないBの一覧に、Aのサイトが出ていない。
    const bBefore = await listedSiteIds(pageB);
    expect(bBefore, '他人のサイトが自分の一覧に出ている').not.toContain(a1.siteId);
    expect(bBefore, '他人のサイトが自分の一覧に出ている').not.toContain(a2.siteId);

    // B-2-a(3): **Aと同じ依頼文**で生成する。生成キャッシュが利用者ごとに分かれていないと、
    // ここが fromCache:true になって保存がスキップされ、Bには1件も残らない（generate() 内で落ちる）。
    const b1 = await generate(pageB, briefA1);
    expect(b1.siteId, 'Bに保存されたサイトがAのものと同一（利用者間で共有されている）').not.toBe(a1.siteId);

    // B-2-c（後半・対照つき）: Bの一覧には**Bのサイトがちょうど1件**出ていて、Aのサイトは1件も出ない。
    // 「ちょうど1件」を要求することで、一覧が壊れて誰にも何も出ない実装では緑にならない。
    const bAfter = await listedSiteIds(pageB);
    expect(bAfter, 'Bの一覧にBのサイトが出ていない（一覧が壊れている可能性）').toEqual([b1.siteId]);
    expect(bAfter, '他人のサイトが自分の一覧に出ている').not.toContain(a1.siteId);
    expect(bAfter, '他人のサイトが自分の一覧に出ている').not.toContain(a2.siteId);

    // B-2-a: 保存されたかどうかの判定材料を書き出す。判定そのものは
    // **サーバー停止後に別プロセス**で scripts/verify-b2-persistence.mjs が行う。
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      JSON.stringify(
        {
          userA: { email: emailA, sites: [{ ...a1, brief: briefA1 }, { ...a2, brief: briefA2 }] },
          userB: { email: emailB, sites: [{ ...b1, brief: briefA1 }] },
        },
        null,
        2,
      ),
      'utf-8',
    );

    await contextA.close();
    await contextB.close();
  });
});
