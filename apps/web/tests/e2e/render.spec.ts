import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

type SeedResult = {
  userId: string;
  sites: Array<{ templateId: string; siteId: string; theme: string }>;
};

const EXPECTED_SECTION_TYPES = [
  'header-01',
  'hero-01',
  'services-01',
  'features-01',
  'about-01',
  'stats-01',
  'process-01',
  'testimonials-01',
  'faq-01',
  'cta-01',
  'contact-01',
  'footer-01',
];

let seed: SeedResult;
let siteA: string;
let siteB: string;

test.beforeAll(async () => {
  const raw = await readFile(path.join(__dirname, '.seed-result.json'), 'utf-8');
  seed = JSON.parse(raw) as SeedResult;
  const [first, second] = seed.sites;
  if (!first || !second) {
    throw new Error('render.spec: seed結果にsitesが2件必要です');
  }
  siteA = first.siteId;
  siteB = second.siteId;
});

async function collectSectionTypes(page: Page, siteId: string, slug: string): Promise<string[]> {
  await page.goto(`/preview/${siteId}${slug}`);
  return page.$$eval('[data-section-type]', (nodes) =>
    nodes.map((n) => n.getAttribute('data-section-type') ?? ''),
  );
}

test('coverage: 2テンプレ4ページで12 sectionType 全種が出現する', async ({ page }) => {
  const found = new Set<string>();

  for (const siteId of [siteA, siteB]) {
    for (const slug of ['', '/about']) {
      const types = await collectSectionTypes(page, siteId, slug);
      types.forEach((t) => found.add(t));
    }
  }

  for (const expected of EXPECTED_SECTION_TYPES) {
    expect(found.has(expected), `missing sectionType: ${expected}`).toBe(true);
  }
  expect(found.size).toBe(EXPECTED_SECTION_TYPES.length);
});

test('single-source build: 全プリミティブDOMのdata-primitive-buildが単一値', async ({ page }) => {
  const buildValues: string[] = [];

  for (const siteId of [siteA, siteB]) {
    for (const slug of ['', '/about']) {
      await page.goto(`/preview/${siteId}${slug}`);
      const values = await page.$$eval('[data-primitive-build]', (nodes) =>
        nodes.map((n) => n.getAttribute('data-primitive-build') ?? ''),
      );
      buildValues.push(...values);
    }
  }

  console.log('reflectedNodes', buildValues.length);
  expect(buildValues.length).toBeGreaterThan(0);
  const uniqueValues = new Set(buildValues);
  expect(uniqueValues.size).toBe(1);
  expect(uniqueValues.has('v1')).toBe(true);
});

test('theme差分: 最外殻data-themeがテンプレごとに異なる', async ({ page }) => {
  await page.goto(`/preview/${siteA}`);
  const themeA = await page.locator('[data-theme]').first().getAttribute('data-theme');
  expect(themeA).toBe('minimal-corporate');

  await page.goto(`/preview/${siteB}`);
  const themeB = await page.locator('[data-theme]').first().getAttribute('data-theme');
  expect(themeB).toBe('warm-studio');
});

test('computed style差分: 同一Buttonプリミティブがテーマ間で異なる背景色になる', async ({
  page,
}) => {
  await page.goto(`/preview/${siteA}`);
  const colorA = await page
    .locator('[data-primitive="button"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.goto(`/preview/${siteB}`);
  const colorB = await page
    .locator('[data-primitive="button"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(colorA).not.toBe(colorB);
});
