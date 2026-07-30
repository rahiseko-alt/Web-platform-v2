import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// global-setup（Bearer 送信側）が dev サーバと同じ .env を読むようにする。
// これがないと SEED_TOKEN が未設定になり seed が 401/403 になる。
loadEnvConfig(process.cwd());


/**
 * 即死仮説#1の実機検証用 E2E 設定。
 * global-setup で /api/seed を叩き、siteId を tests/e2e/.seed-result.json に永続化する。
 * seed 済みの共有状態を specがまたぐため、直列実行（workers:1）に固定する。
 */
export default defineConfig({
  testDir: './tests/e2e',
  // 受入検証のうち**実LLMを叩いて課金が発生する**ものは、通常の `pnpm e2e` からは除外する。
  // 実行はそれぞれの専用 config ＋ 専用ワークフローからのみ（`pnpm e2e:b1` / `e2e:b2` / `e2e:b3` / `e2e:c1`）。
  // これらの spec は「キー未設定なら落とす」方針（SKIP-AS-FAIL）なので、ここへ載せると
  // キーの無い環境で `pnpm e2e` が必ず赤くなる。
  testIgnore: /authed-(generate|persist|score|regenerate)\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
