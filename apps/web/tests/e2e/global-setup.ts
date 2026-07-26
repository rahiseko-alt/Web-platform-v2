import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type SeedResult = {
  userId: string;
  sites: Array<{ templateId: string; siteId: string; theme: string }>;
};

const SEED_URL = 'http://localhost:3000/api/seed';
const OUTPUT_PATH = path.join(__dirname, '.seed-result.json');
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedOnce(): Promise<SeedResult> {
  const response = await fetch(SEED_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SEED_TOKEN ?? ''}` },
  });
  if (!response.ok) {
    throw new Error(`seed request failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as SeedResult;
}

/**
 * devサーバ起動待ちを含むリトライ付き seed 投入。
 * 成功結果を tests/e2e/.seed-result.json へ書き出し、各 spec が siteId を読めるようにする。
 */
export default async function globalSetup(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await seedOnce();
      await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
      return;
    } catch (error) {
      lastError = error;
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error(
    `global-setup: /api/seed に${MAX_ATTEMPTS}回リトライしても成功しませんでした: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
