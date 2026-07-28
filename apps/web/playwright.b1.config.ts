import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

loadEnvConfig(process.cwd());

/**
 * B-1（認証済みフローでの生成）の受入検証専用の設定。
 *
 * 既定の playwright.config.ts と分けている理由:
 * 1. **globalSetup を使わない**。既定側の globalSetup は `/api/seed` を叩き、
 *    users/organizations/sites を**全削除してから**再投入する破壊的操作。B-1 の検証は
 *    自分でサインアップしたアカウントだけで完結するので、その破壊を巻き込む必要が無い。
 * 2. **実LLMを叩く（課金が発生する）**ため、通常の `pnpm e2e` と同じ口で走らせたくない。
 *    実行は専用ワークフロー（.github/workflows/b1-generate-smoke.yml）からのみ。
 *
 * 実LLM往復＋機械ゲートの差し戻し再試行を見込んで、テスト全体のタイムアウトを長めに取る。
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /authed-generate\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
