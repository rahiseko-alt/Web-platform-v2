import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { sectionRegistry } from '@/sections/registry';
import { SECTION_TYPES, SECTION_VARIANTS, THEMES, variantsFor } from '@/generate/vocabulary';
import { sectionContentSchemas } from '@/generate/section-schemas';

const THEMES_DIR = path.join(__dirname, '..', '..', 'src', 'styles', 'themes');

/**
 * 台帳（vocabulary.ts）が実装から乖離したら落ちるテスト（plan 受け入れ基準1）。
 * design トークンの enum は typecheck 側の AssertExhaustive が担保するため、
 * ここでは実行時にしか照合できないもの（レジストリのキー・テーマのCSSファイル）を見る。
 */
describe('機械語彙の台帳 ↔ 実装の一致', () => {
  it('SECTION_TYPES は sectionRegistry のキーと完全一致する', () => {
    expect([...SECTION_TYPES].sort()).toEqual(Object.keys(sectionRegistry).sort());
  });

  it('THEMES は src/styles/themes/*.css と完全一致する', () => {
    const files = readdirSync(THEMES_DIR)
      .filter((f) => f.endsWith('.css'))
      .map((f) => f.replace(/\.css$/, ''));
    expect([...THEMES].sort()).toEqual(files.sort());
  });

  it('全セクション種別に content 契約が定義されている', () => {
    for (const sectionType of SECTION_TYPES) {
      expect(sectionContentSchemas).toHaveProperty(sectionType);
    }
  });

  it('SECTION_VARIANTS のキーは実在するセクション種別だけ', () => {
    for (const sectionType of Object.keys(SECTION_VARIANTS)) {
      expect(SECTION_TYPES).toContain(sectionType);
    }
  });

  it('変種を持たないセクションは空配列を返す', () => {
    expect(variantsFor('hero-01')).toEqual([]);
    expect(variantsFor('services-01')).toContain('editorial-index');
  });
});
