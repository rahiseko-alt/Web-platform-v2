import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * C-1 / C-1-b の受入検証。
 *
 *   C-1   : 依頼文を編集して再生成すると、実際に新しい依頼文で生成が走り、
 *           **同じサイトのまま**内容が置き換わる（新しいサイトが増えない）
 *   C-1-b : ログイン中の利用者でも、**他人のサイトIDを指定した上書き**は拒否される
 *
 * **これは実際に OpenAI を呼ぶ（課金が発生する）テスト**なので、通常の `pnpm e2e` からは外し、
 * 専用ワークフロー（.github/workflows/c1-regenerate-smoke.yml）からのみ実行する。
 * 実LLM呼び出しは **2回だけ**（依頼文A・依頼文B）に抑えている:
 *   - 同一依頼文の再送信（対照）はキャッシュ命中なので 0 回
 *   - C-1-b の攻撃は生成より前に所有権チェックで弾かれる設計なので 0 回
 *
 * 判定はここで完結しない。画面から読めるのは「画面がそう言っている」ことだけなので、
 * 「サイトが増えていない」「他人のサイトの中身が変わっていない」の最終判定は
 * **サーバー停止後に別プロセス**で scripts/verify-c1-overwrite.mjs が保存先を直読みして行う。
 * 停止の担保は b2/b3 と同じ（ワークフローのステップ分離＋Playwright の webServer 終了＋到達性チェック）。
 * ⚠ PGlite は稼働中でも別プロセスから同じ dataDir を開けるので「読めたこと」は停止の証拠にならない
 *   （docs/failures.md 2026-07-28）。
 */

const OUTPUT_PATH = path.join(__dirname, '.c1-result.json');
const PASSWORD = 'C1RegenerateVerify123!';
const GENERATE_TIMEOUT_MS = 180_000;
const BRIEF_PLACEHOLDER = 'どんなサイトが欲しいか';

/** その回限りの目印。置き換わったこと・他人のサイトが汚れていないことを言い切るために使う。 */
function marker(label: string): string {
  return `Z${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();
}

function uniqueEmail(label: string): string {
  return `c1_${label}_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

function briefWith(mark: string, flavor: string): string {
  return `${mark} という名前の${flavor}のサイト。店名の ${mark} は必ず見出しに入れてください。`;
}

async function signUp(context: BrowserContext, email: string): Promise<void> {
  const response = await context.request.post('/api/auth/sign-up/email', {
    data: { email, password: PASSWORD, name: 'C1 E2E' },
  });
  expect(response.ok(), `sign-up failed: ${response.status()}`).toBe(true);
}

/**
 * 実際のログイン画面からログインする（API でトークンを取って差し込まない）。
 * 先に cookie を捨てるのは、サインアップ（better-auth の autoSignIn が既定 true）が発行した
 * セッションを持ち越さないため。
 */
async function loginViaForm(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByPlaceholder('email').fill(email);
  await page.getByPlaceholder('password').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

type Observed = { siteId: string; headline: string; sectionTypes: string[]; fromCache: string };

/**
 * いま画面に出ている生成結果を読む。
 * `data-saved-site-id` は「この画面が紐付いているサイト」を指す（新規保存でも上書きでも付く）。
 */
async function readResult(page: Page): Promise<Observed> {
  const result = page.locator('[data-generate-status="ok"]');
  const failure = page.locator('[data-generate-status="error"]');

  // 生成に失敗した画面（鍵が無効・LLM側のエラー等）が出ているときは、成功マーカーを
  // 180秒待ってから「見つからない」と落ちるのではなく、**その場で理由つきで落とす**。
  // 待ってから落ちると、CIログの結論が「要素が無い」になり、本当の原因（LLM側の応答）が
  // WebServer ログの奥に埋もれて読み取れなくなる。
  await expect(result.or(failure).first()).toBeVisible({ timeout: GENERATE_TIMEOUT_MS });
  if ((await failure.count()) > 0) {
    const reason = (await failure.first().innerText()).trim();
    throw new Error(
      `生成が失敗した画面が出ている: 「${reason}」。受入の前提（実際に生成が走る）が成立していないので、` +
        'このrunはC-1/C-1-bの証拠にならない。CIログの [WebServer] 行でLLM側の応答を確認すること。',
    );
  }

  const fromCache = (await result.getAttribute('data-generate-from-cache')) ?? '';
  const siteId = await result.getAttribute('data-saved-site-id');
  expect(siteId, '生成結果の画面に紐付くサイトIDが出ていない').toBeTruthy();

  const headline = (await result.getByRole('heading').first().innerText()).trim();
  expect(headline.length, '見出しが空（枠だけ描画されている）').toBeGreaterThan(0);

  const sectionTypes = await page.locator('[data-section-type]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-section-type') ?? ''),
  );
  expect(sectionTypes.length, 'セクションが1つも描画されていない').toBeGreaterThan(0);

  return { siteId: siteId as string, headline, sectionTypes, fromCache };
}

/**
 * **実際の送信UI**（textarea へ入力 → 生成ボタンをクリック）で依頼文を送る。
 * クエリを直接書き換えて遷移する方法は使わない：送信経路の破損を検出できないため
 * （B-1 で独立検証者に指摘された経緯がある）。
 *
 * 待ち方に URL 変化を使わない理由:
 *   このテストは**同じ依頼文をそのまま再送信する対照**（キャッシュ命中の確認）を行う。
 *   そのときURLは送信前と送信後で同一なので、`waitForURL` は即座に解決してしまい、
 *   **前のページのDOMを読んだまま**判定に進む（＝観測対象がすり替わる）。
 *   代わりに実際のナビゲーション応答を待つ。応答は毎回必ず1つ返るので、
 *   URLが変わらない送信でも取り違えない。
 */
async function submitBrief(page: Page, brief: string): Promise<void> {
  const textarea = page.getByPlaceholder(BRIEF_PLACEHOLDER);
  await textarea.fill(brief);

  const navigation = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() && new URL(response.url()).pathname === '/generate',
    { timeout: GENERATE_TIMEOUT_MS },
  );
  await page.getByRole('button', { name: '生成' }).click();
  const response = await navigation;
  expect(response.status(), `依頼文の送信が失敗した (HTTP ${response.status()})`).toBe(200);
  await page.waitForLoadState('domcontentloaded');

  // 送った依頼文が実際にURLへ乗っていること（＝送信経路が生きていることの確認）
  expect(
    new URL(page.url()).searchParams.get('brief'),
    '送信した依頼文がURLに乗っていない（送信経路が壊れている）',
  ).toBe(brief);
}

test.describe('C-1: 依頼文を直して再生成すると同じサイトが置き換わる', () => {
  test.beforeAll(() => {
    // キーが無いのに「緑」に見える状態を作らない。未設定は**テストの失敗**として扱う。
    expect(
      process.env.OPENAI_API_KEY,
      'OPENAI_API_KEY が未設定です。このテストは実LLMでの受入検証なのでスキップせず落とします。',
    ).toBeTruthy();
  });

  test('言い直しは上書きになり、他人のサイトの上書きは拒否される', async ({ browser }) => {
    const markA = marker('A');
    const markB = marker('B');
    const markC = marker('C');
    const briefA = briefWith(markA, '小さな喫茶店');
    const briefB = briefWith(markB, '静かな古書店');
    const briefC = briefWith(markC, '町の自転車屋');

    const ownerEmail = uniqueEmail('owner');
    const attackerEmail = uniqueEmail('attacker');

    // ---- 利用者A（所有者）----
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signUp(ownerContext, ownerEmail);
    await loginViaForm(ownerPage, ownerEmail);

    // 1回目：依頼文A で生成する（実LLM 1回目）
    await ownerPage.goto('/generate');
    await submitBrief(ownerPage, briefA);
    const first = await readResult(ownerPage);
    expect(first.fromCache, '1回目がキャッシュ再表示になっている（実際にLLMを呼んでいない）').toBe('false');
    await expect(
      ownerPage.locator('[data-generate-status="ok"]').getByText(markA, { exact: false }).first(),
      '1回目の目印が生成結果に出ていない',
    ).toBeVisible();

    // 2回目：**同じ画面のテキストエリアを操作して**依頼文B へ言い直す（実LLM 2回目）
    await submitBrief(ownerPage, briefB);
    const second = await readResult(ownerPage);

    // C-1 (1)：実際にLLMを呼んだ（キャッシュ再表示ではない）
    expect(second.fromCache, '言い直しがキャッシュ再表示になっている（新しい依頼文で生成していない）').toBe('false');

    // C-1 (2)：同じサイトのまま＝新しいサイトが増えていない（最終判定は verify:c1 が保存先で行う）
    expect(second.siteId, '言い直しで別のサイトが作られた（上書きになっていない）').toBe(first.siteId);

    // C-1 (3)：中身が実際に置き換わった（目印Bが在り、目印Aは無い）
    const resultRegion = ownerPage.locator('[data-generate-status="ok"]');
    await expect(
      resultRegion.getByText(markB, { exact: false }).first(),
      '言い直し後の目印が生成結果に出ていない',
    ).toBeVisible();
    expect(
      await resultRegion.innerText(),
      '言い直したのに前回の目印が生成結果に残っている',
    ).not.toContain(markA);

    // C-1 (4) 対照：同じ依頼文をそのまま再送信するとキャッシュ再表示になる
    // （＝何を送っても新規生成扱いになる実装ではないことの対照。LLM は呼ばれない）
    await submitBrief(ownerPage, briefB);
    const third = await readResult(ownerPage);
    expect(third.fromCache, '同じ依頼文の再送信でも実LLMを呼んでいる（キャッシュが効いていない）').toBe('true');
    expect(third.siteId, 'キャッシュ再表示でサイトの紐付きが切れている').toBe(first.siteId);

    // ---- 利用者B（攻撃者・別ブラウザコンテキスト＝Aのセッションを引き継がない）----
    const attackerContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();
    await signUp(attackerContext, attackerEmail);
    await loginViaForm(attackerPage, attackerEmail);

    // 対照：Bはログインできていて、生成の入口自体には入れる。
    // これが無いと「Bのセッションが壊れているだけ」でも下の拒否が緑になり、
    // 所有権チェックが効いた証明にならない。
    await attackerPage.goto('/generate');
    await expect(
      attackerPage.locator('[data-generate-status="empty"]'),
      '攻撃者側がログイン済みで生成画面に入れていない（拒否の対照が成立しない）',
    ).toBeVisible();

    // C-1-b：hidden field を**実際に書き換えて**、Aのサイトの上書きを試みる。
    await attackerPage.getByPlaceholder(BRIEF_PLACEHOLDER).fill(briefC);
    await attackerPage.evaluate((siteId) => {
      const form = document.querySelector('form[action="/generate"]');
      if (!form) throw new Error('生成フォームが見つからない（hidden field を仕込めない）');
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'siteId';
      input.value = siteId;
      form.appendChild(input);
    }, first.siteId);

    const navigation = attackerPage.waitForResponse(
      (response) =>
        response.request().isNavigationRequest() && new URL(response.url()).pathname === '/generate',
      { timeout: GENERATE_TIMEOUT_MS },
    );
    await attackerPage.getByRole('button', { name: '生成' }).click();
    const response = await navigation;

    // 拒否されること。/editor/[siteId] と同じく notFound() へ丸める設計なので 404
    // （401/403/404 を画面では区別しない＝エラー隠蔽。docs/design-notes.md §4-1）。
    expect(
      response.status(),
      `他人のサイトIDを指定した上書きが拒否されていない（HTTP ${response.status()}）`,
    ).toBe(404);
    await expect(
      attackerPage.locator('[data-generate-status="ok"]'),
      '拒否されるべき送信で生成結果が表示されている',
    ).toHaveCount(0);

    // 判定材料を書き出す。「サイトが増えていない」「Aの中身が汚れていない」の最終判定は
    // **サーバー停止後に別プロセス**で scripts/verify-c1-overwrite.mjs が行う。
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      JSON.stringify(
        {
          owner: {
            email: ownerEmail,
            siteId: first.siteId,
            briefA,
            briefB,
            markerA: markA,
            markerB: markB,
            headline: second.headline,
            sectionTypes: second.sectionTypes,
          },
          attacker: {
            email: attackerEmail,
            markerC: markC,
            briefC,
            targetSiteId: first.siteId,
            rejectedStatus: response.status(),
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    await ownerContext.close();
    await attackerContext.close();
  });
});
