import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());

/**
 * B-2（生成されたLPが自分の所有物として保存される）の受入検証専用の設定。
 *
 * playwright.b1.config.ts と分けている理由は「葉ごとに独立して再検証できる状態を保つ」ため。
 * B-1 と束ねると、B-2 のためにテストを直すたびに B-1 の evidence も取り直しになる。
 *
 * globalSetup は使わない: 既定側の globalSetup は `/api/seed` を叩いて users/organizations/sites を
 * **全削除してから**再投入する破壊的操作で、この検証が作ったアカウントとサイトを消してしまう。
 * ここで作るデータはテスト内で自分でサインアップして用意する。
 *
 * 実LLM往復（3回）＋機械ゲートの差し戻し再試行を見込んでタイムアウトを長めに取る。
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /authed-persist\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 600_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    // CI では既存サーバーを再利用しない。:3000 に別プロセスが居ると、ビルドした成果物ではなく
    // そちらを検証してしまい、evidence が「何を検証したのか」不明になる。
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
