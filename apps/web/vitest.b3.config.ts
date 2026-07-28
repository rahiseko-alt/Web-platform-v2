import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * B-3（機械採点の独立再計算）の受入検証専用の設定。
 *
 * 既定の vitest.config.ts と分けている理由は playwright.b1/b2.config.ts と同じ：
 * ここは **アプリのサーバーを停止したあと**、実データが入った PGlite（PGLITE_DATA_DIR、
 * 既定は ./.pglite）を読む。既定の unit test 群は毎回 memory:// の使い捨てDBを使うため、
 * 同じ include に混ぜると通常の `pnpm test` が実データを読もうとして壊れる。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/verify/**/*.test.ts'],
    // vitest.config.ts と同じ理由（PGlite の実クエリを複数回行う）。今はこのincludeに
    // ファイルが1つしか無く並列競合は起きないが、将来 tests/verify/ が増えたときの
    // 既定10秒超過を先回りで防いでおく。
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
