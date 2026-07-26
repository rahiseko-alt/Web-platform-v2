import { describe, it, expect } from 'vitest';
import { applyOverrides } from '@/generate/overrides';
import type { GeneratedPage } from '@/generate/types';

function basePage(): GeneratedPage {
  return {
    design: {
      heroVariant: 'split-editorial',
      rhythm: 'normal',
      align: 'centered',
      sectionVariants: { 'services-01': 'horizontal-rail' },
      cardStyle: 'soft',
      buttonShape: 'pill',
    },
    theme: 'minimal-corporate',
    palette: 'theme-default',
    motion: 'still',
    sections: [
      { id: 'services-01-0', sectionType: 'services-01', order: 0, content: {} },
    ],
    needsReview: false,
    unknowns: [],
  };
}

describe('要素値の差し替え（LLM を呼ばない微調整）', () => {
  it('台帳内の値は差し替わる', () => {
    const { page, ignored } = applyOverrides(basePage(), {
      theme: 'warm-studio',
      palette: 'deep-navy',
      motion: 'rich',
      heroVariant: 'typographic-kinetic',
      rhythm: 'loose',
      align: 'asymmetric',
      sectionVariants: { 'services-01': 'editorial-index' },
    });

    expect(page.theme).toBe('warm-studio');
    expect(page.palette).toBe('deep-navy');
    expect(page.motion).toBe('rich');
    expect(page.design.heroVariant).toBe('typographic-kinetic');
    expect(page.design.rhythm).toBe('loose');
    expect(page.design.align).toBe('asymmetric');
    expect(page.design.sectionVariants?.['services-01']).toBe('editorial-index');
    expect(ignored).toEqual([]);
  });

  it('未指定の項目は元の値を保つ', () => {
    const { page } = applyOverrides(basePage(), { rhythm: 'tight' });
    expect(page.design.rhythm).toBe('tight');
    expect(page.theme).toBe('minimal-corporate');
    expect(page.design.heroVariant).toBe('split-editorial');
    expect(page.design.cardStyle).toBe('soft');
    expect(page.design.buttonShape).toBe('pill');
  });

  it('cardStyle/buttonShape は台帳内の値へ差し替わる', () => {
    const { page, ignored } = applyOverrides(basePage(), { cardStyle: 'bold', buttonShape: 'rounded' });
    expect(page.design.cardStyle).toBe('bold');
    expect(page.design.buttonShape).toBe('rounded');
    expect(ignored).toEqual([]);
  });

  it('cardStyle/buttonShape の台帳外の値は採用せず ignored に出す', () => {
    const { page, ignored } = applyOverrides(basePage(), { cardStyle: 'square', buttonShape: 'sharp' });
    expect(page.design.cardStyle).toBe('soft'); // 元のまま
    expect(page.design.buttonShape).toBe('pill'); // 元のまま
    expect(ignored).toContain('cardStyle=square');
    expect(ignored).toContain('buttonShape=sharp');
  });

  it('台帳外の値は採用せず、黙殺もせず ignored に出す', () => {
    const { page, ignored } = applyOverrides(basePage(), {
      theme: 'dark-luxury',
      heroVariant: 'cinematic-parallax',
    });

    expect(page.theme).toBe('minimal-corporate'); // 元のまま
    expect(page.design.heroVariant).toBe('split-editorial');
    expect(ignored).toContain('theme=dark-luxury');
    expect(ignored).toContain('heroVariant=cinematic-parallax');
  });

  it('変種を持たないセクションへの指定は ignored に出す', () => {
    const { page, ignored } = applyOverrides(basePage(), {
      sectionVariants: { 'hero-01': 'split-editorial' },
    });

    expect(page.design.sectionVariants?.['hero-01']).toBeUndefined();
    expect(ignored).toContain('hero-01=split-editorial');
  });

  it('動きの内訳は未指定なら強度の既定セットに展開される', () => {
    expect(applyOverrides(basePage(), {}).motionEffects).toEqual([]); // still
    expect(applyOverrides(basePage(), { motion: 'subtle' }).motionEffects).toEqual(['reveal']);
    expect(applyOverrides(basePage(), { motion: 'rich' }).motionEffects).toEqual([
      'hover',
      'reveal',
      'stagger',
      'parallax',
    ]);
  });

  it('動きの内訳をチェックで指定したら、その通りに効く（強度の既定より優先）', () => {
    const { motionEffects } = applyOverrides(basePage(), { motion: 'rich', motionEffects: ['hover', 'parallax'] });
    expect(motionEffects).toEqual(['hover', 'parallax']);
  });

  it('チェックを全部外した指定（空配列）は「未指定」に戻さず静止にする', () => {
    const { motionEffects } = applyOverrides(basePage(), { motion: 'rich', motionEffects: [] });
    expect(motionEffects).toEqual([]);
  });

  it('台帳外の内訳は採用せず ignored に出す', () => {
    const { motionEffects, ignored } = applyOverrides(basePage(), { motionEffects: ['hover', 'explode'] });
    expect(motionEffects).toEqual(['hover']);
    expect(ignored).toContain('motionEffects=explode');
  });

  it('元のページを破壊しない（新しいオブジェクトを返す）', () => {
    const original = basePage();
    applyOverrides(original, { theme: 'warm-studio', sectionVariants: { 'services-01': 'editorial-index' } });
    expect(original.theme).toBe('minimal-corporate');
    expect(original.design.sectionVariants?.['services-01']).toBe('horizontal-rail');
  });
});
