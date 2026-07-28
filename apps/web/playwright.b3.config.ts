import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());

/**
 * B-3（機械採点が内訳込みで表示される）の受入検証専用の設定。
 *
 * playwright.b1/b2.config.ts と分けている理由は「葉ごとに独立して再検証できる状態を保つ」ため。
 *
 * globalSetup は使わない：既定側は `/api/seed` で users/organizations/sites を全削除してから
 * 再投入する破壊的操作で、この検証が作ったアカウントとサイトを消してしまう。
 *
 * 実LLM往復＋機械ゲートの差し戻し再試行を見込んでタイムアウトを長めに取る。
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /authed-score\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
