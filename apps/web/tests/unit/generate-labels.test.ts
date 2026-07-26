import { describe, it, expect } from 'vitest';
import { ALL_VOCABULARY_VALUES, VALUE_LABELS_JA, labelJa } from '@/generate/labels';
import { EFFECTS_BY_MOTION, MOTIONS, MOTION_EFFECTS, PALETTES } from '@/generate/vocabulary';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('日本語ラベル', () => {
  it('台帳の全値に日本語ラベルがある（足し忘れを機械で検知）', () => {
    const missing = ALL_VOCABULARY_VALUES.filter((v) => !(v in VALUE_LABELS_JA));
    expect(missing).toEqual([]);
  });

  it('未登録の値はそのまま返す（黙って空にしない）', () => {
    expect(labelJa('not-registered')).toBe('not-registered');
  });
});

describe('新軸の台帳とCSS実体が 1:1', () => {
  it('palette の全値が palettes.css に存在する（theme-default は上書き無しが正）', () => {
    const css = readFileSync(join(root, 'src/styles/palettes.css'), 'utf8');
    for (const palette of PALETTES) {
      if (palette === 'theme-default') {
        expect(css).not.toContain(`[data-palette='theme-default']`);
        continue;
      }
      expect(css).toContain(`[data-palette='${palette}']`);
    }
  });

  it('動きの内訳の全値が motion.css に存在する（実際に効くのは内訳）', () => {
    const css = readFileSync(join(root, 'src/styles/motion.css'), 'utf8');
    for (const effect of MOTION_EFFECTS) {
      expect(css).toContain(`[data-motion-effects~='${effect}']`);
    }
  });

  it('motion（強度）の既定内訳が台帳の値だけで構成されている', () => {
    for (const motion of MOTIONS) {
      const effects = EFFECTS_BY_MOTION[motion];
      expect(effects.every((effect) => (MOTION_EFFECTS as readonly string[]).includes(effect))).toBe(true);
    }
    // still は「動かない」が正。内訳を1つでも持ったら静止が壊れている
    expect(EFFECTS_BY_MOTION.still).toEqual([]);
  });

  it('globals.css が palette / motion を読み込んでいる', () => {
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
    expect(css).toContain('styles/palettes.css');
    expect(css).toContain('styles/motion.css');
  });
});
