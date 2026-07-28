import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig の paths（@ -> src）と整合させ、テストから @ エイリアスを解決可能にする
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/verify/**', 'node_modules/**'],
    // PGlite を beforeAll で起動するテストファイルが複数（user-sites / generated-page-scoring）
    // 並列実行されると初期化がCPU負荷で既定の10秒を超えることがある（実測でflaky）。
    hookTimeout: 30_000,
  },
});
