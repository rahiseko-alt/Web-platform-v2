import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // vibe-base 配下の複数 lockfile による workspace root 誤検出を防ぐ
  outputFileTracingRoot: __dirname,
  // PGlite は wasm/fs を new URL(...) で解決するため webpack バンドル対象から除外する
  // （バンドルすると path 解決が壊れ ERR_INVALID_ARG_TYPE になる）
  serverExternalPackages: ['@electric-sql/pglite'],
  // Vercel Blob（P1#8・画像アップロード）のpublic URLを<Image>最適化対象として許可
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
};

export default nextConfig;
