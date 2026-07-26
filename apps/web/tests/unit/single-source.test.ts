import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const BLOCKS_DIR = path.join(__dirname, '..', '..', 'src', 'sections', 'blocks');
const RAW_TAG_PATTERN = /<(button|h[1-6])[\s>]/;
const PRIMITIVE_IMPORT_PATTERN = /from ['"]@\/components['"]/;

describe('single-source guarantee (即死仮説#1)', () => {
  const files = readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.tsx'));

  it('セクションblockが12個存在する', () => {
    expect(files.length).toBe(12);
  });

  it.each(files)('%s は生タグ(<button>/<h1>-<h6>)を直書きしない', (file) => {
    const source = readFileSync(path.join(BLOCKS_DIR, file), 'utf-8');
    expect(RAW_TAG_PATTERN.test(source)).toBe(false);
  });

  it.each(files)('%s は @/components からprimitiveをimportする', (file) => {
    const source = readFileSync(path.join(BLOCKS_DIR, file), 'utf-8');
    expect(PRIMITIVE_IMPORT_PATTERN.test(source)).toBe(true);
  });
});
