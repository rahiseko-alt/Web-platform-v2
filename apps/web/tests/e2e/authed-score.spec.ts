import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { SCORE_KEY_ORDER } from '@/eval/rubric';

/**
 * B-3: 生成した直後に、機械採点が内訳込みで画面に出る — 実LLMを叩く受入検証。
 *
 * B-3-a（点数が出る）／B-3-b（減点理由が読める）の両方をこの1本で判定する。
 * 判定そのものはここでは行わない：ここは画面の観測結果を tests/e2e/.b3-result.json へ
 * 書き出すだけに留め、**サーバー停止後に別プロセス**で tests/verify/b3-score.test.ts
 * （`pnpm --filter web verify:b3`）が保存先を直接読んで再計算し、突き合わせる。
 *
 * **これは実際に OpenAI を呼ぶ（課金が発生する）テスト**なので、通常の `pnpm e2e` からは外し、
 * 専用ワークフロー（.github/workflows/b3-score-smoke.yml）からのみ実行する。
 */

const OUTPUT_PATH = path.join(__dirname, '.b3-result.json');
const PASSWORD = 'B3ScoreVerify123!';
const GENERATE_TIMEOUT_MS = 180_000;

// B-2 の受入テストと違い、依頼文の一語一句を本文へ強制する指示は入れない。
// A（依頼文の反映）が自然に満点未満になりやすくする＝B-3-b の SKIP-AS-FAIL 条件
// （満点未満の項目が1つ以上ある）を人工的な細工なしで満たすため。
const BRIEF =
  '渋谷にある小さな鍼灸院のサイト。長年の経験を活かした施術と、初めての人でも安心できる説明を大事にしている。';

function uniqueEmail(): string {
  return `b3_e2e_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

test.describe('B-3: 生成直後の機械採点表示', () => {
  test.beforeAll(() => {
    // スキップ経路を残さない。未設定は**テストの失敗**として扱う（b1/b2 と同じ方式）。
    expect(
      process.env.OPENAI_API_KEY,
      'OPENAI_API_KEY が未設定です。このテストは実LLMでの受入検証なのでスキップせず落とします。',
    ).toBeTruthy();
  });

  test('ログイン中に生成すると、その場の画面に機械採点が内訳込みで出る', async ({ page, request }) => {
    const email = uniqueEmail();

    const signUp = await request.post('/api/auth/sign-up/email', {
      data: { email, password: PASSWORD, name: 'B3 E2E' },
    });
    expect(signUp.ok(), `sign-up failed: ${signUp.status()}`).toBe(true);

    // 実ログイン画面からログインする（A-2 / B-1 / B-2 の受入方針を踏襲）。
    await page.goto('/login');
    await page.getByPlaceholder('email').fill(email);
    await page.getByPlaceholder('password').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });

    // 実際の送信UIから依頼文を送る（クエリ直叩きは送信経路の破損を検出できない：B-1の教訓）。
    await page.goto('/generate');
    await page.getByPlaceholder('どんなサイトが欲しいか').fill(BRIEF);
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('brief') === BRIEF, { timeout: GENERATE_TIMEOUT_MS }),
      page.getByRole('button', { name: '生成' }).click(),
    ]);

    const result = page.locator('[data-generate-status="ok"]');
    await expect(result).toBeVisible({ timeout: GENERATE_TIMEOUT_MS });
    await expect(result).toHaveAttribute('data-generate-from-cache', 'false');

    const siteId = await result.getAttribute('data-saved-site-id');
    expect(siteId, '生成は成功したのに保存された siteId が画面に出ていない').toBeTruthy();

    // B-3-a: 生成結果が出たその画面に、追加の操作なしに機械採点が出ている。
    const scoreCard = page.locator('[data-eval="machine-score"]');
    await expect(scoreCard).toBeVisible();

    const totalText = await scoreCard.getAttribute('data-eval-total');
    const maxText = await scoreCard.getAttribute('data-eval-max');
    expect(totalText, '合計点が画面に出ていない').toBeTruthy();
    expect(maxText, '満点が画面に出ていない').toBeTruthy();
    const total = Number(totalText);
    const max = Number(maxText);
    expect(max, '満点は50点満点のはず').toBe(50);

    const items: Record<string, { score: number; max: number; notes: string[] }> = {};
    for (const key of SCORE_KEY_ORDER) {
      const itemLocator = scoreCard.locator(`[data-eval-item="${key}"]`);
      await expect(itemLocator, `項目 ${key} が画面に出ていない`).toBeAttached();

      const score = Number(await itemLocator.getAttribute('data-eval-item-score'));
      const itemMax = Number(await itemLocator.getAttribute('data-eval-item-max'));
      const notes = await itemLocator.locator('[data-eval-note]').allInnerTexts();

      items[key] = { score, max: itemMax, notes };
    }

    // 合計が内訳の和と一致すること（表示・データの取り違えが無いことの一次確認）
    const sumOfItems = Math.round(SCORE_KEY_ORDER.reduce((sum, key) => sum + items[key].score, 0) * 10) / 10;
    expect(sumOfItems, '画面の合計が内訳の和と一致しない').toBe(total);

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      JSON.stringify({ siteId, screen: { total, max, items } }, null, 2),
      'utf-8',
    );
  });
});
