import { test, expect } from '@playwright/test';

/**
 * B-1: 認証済みユーザーが依頼文を送るとLPが生成される — 実LLMを叩く受入検証。
 *
 * **これは実際に OpenAI を呼ぶ（課金が発生する）テスト**なので、通常の `pnpm e2e` からは外し、
 * 専用ワークフロー（.github/workflows/b1-generate-smoke.yml）からのみ実行する。
 * 実行条件は OPENAI_API_KEY が環境にあること。キーはリポジトリの Secrets に置き、
 * **チャットにも作業環境にも平文で置かない**（docs/failures.md 2026-07-28 の教訓）。
 *
 * evidence は「このテストが通った CI の run URL」という外部事実になる
 * （AGENTS.md「evidence は偽造不能な外部事実のみ」）。
 *
 * 判定は画面文言ではなく data 属性で行う（文言変更で壊れる脆い検証にしない）:
 *   data-generate-status="ok" / data-generated-page="generated-page"
 */

const BRIEF =
  '渋谷にある小さなコーヒースタンドのサイト。落ち着いた雰囲気で、こだわりの豆とテイクアウトを見せたい。';

/** 実LLM往復は10〜20秒かかるうえ、機械ゲート差し戻しで再試行が入ることがある。 */
const GENERATE_TIMEOUT_MS = 180_000;

function uniqueEmail(): string {
  // 同一 run 内で重複しないアドレス。CI は毎回クリーンDBだが念のため一意にする。
  return `b1_e2e_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

const PASSWORD = 'B1GenerateVerify123!';

test.describe('B-1: 認証済みフローでの生成', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY 未設定のため実LLM検証をスキップ');

  test('未ログインで /generate へ行くとログイン画面へ誘導される（対照実験）', async ({ page }) => {
    // 「常に生成できる」実装ではないこと＝認証が実際に効いていることの対照。
    await page.goto('/generate');
    await expect(page).toHaveURL(/\/login/);
  });

  test('ログイン中に依頼文を送信すると生成が実行され、結果が返る', async ({ page, request }) => {
    const email = uniqueEmail();

    // A-1（サインアップ）は検証済みなので、ここでは API で作成して本題へ進む。
    const signUp = await request.post('/api/auth/sign-up/email', {
      data: { email, password: PASSWORD, name: 'B1 E2E' },
    });
    expect(signUp.ok(), `sign-up failed: ${signUp.status()}`).toBe(true);

    // サインアップが自動発行するセッションは使わず、**実際のログイン画面から**ログインする
    // （A-2 の検証方針を踏襲。「ログイン中である」ことを実フローで作る）。
    await page.goto('/login');
    await page.getByPlaceholder('email').fill(email);
    await page.getByPlaceholder('password').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });

    // ここが本題：ログイン中に依頼文を送る。
    await page.goto(`/generate?brief=${encodeURIComponent(BRIEF)}`, {
      timeout: GENERATE_TIMEOUT_MS,
    });

    // 生成結果が返ったことを data 属性で判定する。
    const result = page.locator('[data-generate-status="ok"]');
    await expect(result).toBeVisible({ timeout: GENERATE_TIMEOUT_MS });
    await expect(page.locator('[data-generated-page="generated-page"]')).toHaveCount(1);

    // 「枠だけ出た」で緑にしない。実際にセクションが描画されていることまで見る。
    const sections = page.locator('[data-section-type]');
    expect(await sections.count()).toBeGreaterThan(0);
  });
});
