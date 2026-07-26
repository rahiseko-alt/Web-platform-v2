import { describe, it, expect } from 'vitest';
import { scoreDiversity } from '@/eval/diversity';
import type { GeneratedPage } from '@/generate/types';

/** 多様性は design 軸と構成しか見ないので、content は空でよい */
function page(overrides: Partial<GeneratedPage> & { sectionTypes: string[] }): GeneratedPage {
  const { sectionTypes, ...rest } = overrides;
  return {
    design: { heroVariant: 'split-editorial', rhythm: 'normal', align: 'centered', sectionVariants: {} },
    theme: 'minimal-corporate',
    palette: 'light-gray',
    motion: 'subtle',
    needsReview: false,
    unknowns: [],
    sections: sectionTypes.map((sectionType, index) => ({
      id: `${sectionType}-${index}`,
      sectionType,
      order: index,
      content: {},
    })),
    ...rest,
  };
}

const BASE_TYPES = ['header-01', 'hero-01', 'services-01', 'contact-01', 'footer-01'];

/** 全軸が取りうる値を（6件の範囲で）出し切ったセット */
function variedPages(): GeneratedPage[] {
  const themes = ['minimal-corporate', 'warm-studio', 'bold-editorial'];
  const palettes = ['theme-default', 'light-gray', 'deep-navy', 'warm-sand', 'ink-black', 'fresh-green'];
  const motions = ['still', 'subtle', 'rich'];
  const heroVariants = ['fullbleed-asymmetric', 'typographic-kinetic', 'split-editorial'];
  const cardStyles = ['flat', 'soft', 'bold'];
  const buttonShapes = ['rounded', 'pill'];
  const variants: Array<Record<string, string>> = [
    {},
    { 'services-01': 'horizontal-rail' },
    { 'services-01': 'editorial-index' },
    { 'cta-01': 'centered' },
    { 'cta-01': 'split-media' },
    { 'services-01': 'horizontal-rail', 'cta-01': 'centered' },
  ];
  const extras = ['features-01', 'about-01', 'faq-01', 'process-01', 'testimonials-01', 'stats-01'];

  return palettes.map((palette, index) =>
    page({
      sectionTypes: [...BASE_TYPES, extras[index]],
      theme: themes[index % themes.length],
      palette,
      motion: motions[index % motions.length],
      design: {
        heroVariant: heroVariants[index % heroVariants.length] as GeneratedPage['design']['heroVariant'],
        rhythm: 'normal',
        align: 'centered',
        sectionVariants: variants[index],
        cardStyle: cardStyles[index % cardStyles.length] as GeneratedPage['design']['cardStyle'],
        buttonShape: buttonShapes[index % buttonShapes.length] as GeneratedPage['design']['buttonShape'],
      },
    }),
  );
}

describe('scoreDiversity', () => {
  it('全件同じ結果なら 0/10（金太郎飴）', () => {
    const pages = Array.from({ length: 6 }, () => page({ sectionTypes: BASE_TYPES }));
    const result = scoreDiversity(pages);

    expect(result.measurable).toBe(true);
    expect(result.score).toBe(0);
    expect(result.axes.every((axis) => axis.distinct === 1)).toBe(true);
    expect(result.notes.join()).toContain('全件同値の軸');
  });

  it('全軸が振れていれば 10/10', () => {
    const result = scoreDiversity(variedPages());

    expect(result.score).toBe(10);
    expect(result.axes.every((axis) => axis.fraction === 1)).toBe(true);
  });

  it('一部の軸だけ振れている場合は中間点になる', () => {
    const pages = variedPages().map((entry) => ({ ...entry, palette: 'light-gray' }));
    const result = scoreDiversity(pages);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(10);
    expect(result.axes.find((axis) => axis.axis === 'palette')?.distinct).toBe(1);
  });

  it('1件では測定不能（満点を与えない）', () => {
    const result = scoreDiversity([page({ sectionTypes: BASE_TYPES })]);

    expect(result.measurable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.notes.join()).toContain('2件以上');
  });
});
