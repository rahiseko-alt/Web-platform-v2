import { describe, it, expect } from 'vitest';
import { assemblePage, validateLlmOutput } from '@/generate/validate';
import { buildSystemPrompt, buildRetryPrompt } from '@/generate/prompt';

/**
 * 契約を満たす最小の正常出力。各テストはここから1点だけ壊して拒否を確認する。
 * 型は意図的に緩くする（壊した値を渡すのがテストの目的のため、TS で先に弾かれると検証にならない）。
 */
type LooseOutput = {
  design: {
    heroVariant: string;
    rhythm: string;
    align: string;
    sectionVariants: Record<string, string>;
  };
  theme: string;
  palette: string;
  motion: string;
  sections: Array<{ sectionType: string; content: Record<string, unknown> }>;
  needs_review: boolean;
  unknowns: string[];
};

function validOutput(): LooseOutput {
  return {
    design: {
      heroVariant: 'split-editorial',
      rhythm: 'loose',
      align: 'asymmetric',
      sectionVariants: { 'services-01': 'editorial-index' },
    },
    theme: 'minimal-corporate',
    palette: 'light-gray',
    motion: 'subtle',
    sections: [
      {
        sectionType: 'header-01',
        content: {
          logo: 'nail atelier reve',
          navItems: [
            { label: 'MENU', href: '#services' },
            { label: 'ACCESS', href: '#contact' },
          ],
          ctaLabel: 'WEB予約',
          ctaHref: '#contact',
          phone: '03-0000-0000',
        },
      },
      {
        sectionType: 'hero-01',
        content: {
          badge: '完全予約制',
          title: '爪先から、静かに整う。',
          subtitle: '渋谷の隠れ家で、指先だけでなく心もほどける時間を過ごせる完全個室のネイルサロンです。',
          ctaLabel: 'WEB予約する',
          ctaHref: '#contact',
          secondaryLabel: '料金メニューを見る',
          secondaryHref: '#services',
          imageUrl: 'https://example.test/hero.jpg',
          anchor: 'bottom-left',
        },
      },
      {
        sectionType: 'services-01',
        content: {
          heading: 'MENU',
          items: [
            { title: 'シンプルジェル', price: '¥7,700', description: '上品な一色仕上げ。', imageUrl: 'https://example.test/a.jpg' },
            { title: '大人フレンチ', price: '¥9,900', description: 'くすみカラーの大人フレンチ。', imageUrl: 'https://example.test/b.jpg' },
            { title: 'ハンドケア', price: '¥6,600', description: '甘皮と角質を整える集中ケア。', imageUrl: 'https://example.test/c.jpg' },
          ],
        },
      },
      {
        sectionType: 'footer-01',
        content: {
          columns: [
            {
              title: 'MENU',
              links: [
                { label: 'ジェル', href: '#services' },
                { label: 'ケア', href: '#services' },
              ],
            },
          ],
          copyright: '© 2026 nail atelier reve',
        },
      },
    ],
    needs_review: false,
    unknowns: [],
  };
}

describe('機械制御ゲート: 許可', () => {
  it('契約を満たす出力は許可される', () => {
    const result = validateLlmOutput(validOutput());
    expect(result.ok).toBe(true);
  });

  it('許可された出力は id と order を機械が採番して組み立てる', () => {
    const result = validateLlmOutput(validOutput());
    if (!result.ok) throw new Error('許可されるはずの出力が拒否された');
    const page = assemblePage(result.value);
    expect(page.sections.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    expect(page.sections[0].id).toBe('header-01-0');
    expect(page.design.heroVariant).toBe('split-editorial');
    expect(page.theme).toBe('minimal-corporate');
  });
});

describe('機械制御ゲート: 拒否（既定値での無音フォールバックが無いこと）', () => {
  it('台帳に無い heroVariant は拒否され、既定値で埋められない', () => {
    const output = validOutput();
    output.design.heroVariant = 'cinematic-parallax';
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.path.includes('heroVariant'))).toBe(true);
  });

  it('台帳に無い theme は拒否される', () => {
    const output = validOutput();
    output.theme = 'dark-luxury';
    expect(validateLlmOutput(output).ok).toBe(false);
  });

  it('台帳に無いセクション種別は拒否される', () => {
    const output = validOutput();
    output.sections[2].sectionType = 'pricing-01';
    expect(validateLlmOutput(output).ok).toBe(false);
  });

  it('変種を持たないセクションへの sectionVariants 指定は拒否される', () => {
    const output = validOutput();
    output.design.sectionVariants = { 'hero-01': 'split-editorial' };
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0].reason).toContain('変種を持たない');
  });

  it('台帳に無い変種の値は、許可値を添えて拒否される', () => {
    const output = validOutput();
    output.design.sectionVariants = { 'services-01': 'masonry-grid' };
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections[0].reason).toContain('horizontal-rail');
  });

  it('必須フィールドの欠落は拒否される', () => {
    const output = validOutput();
    delete (output.sections[1].content as Record<string, unknown>).title;
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.path.includes('sections.1.content.title'))).toBe(true);
  });

  it('項目数が枠を下回ると拒否される', () => {
    const output = validOutput();
    const items = output.sections[2].content.items as unknown[];
    output.sections[2].content.items = [items[0]];
    expect(validateLlmOutput(output).ok).toBe(false);
  });

  it('footer-01 が末尾でないと拒否される（機械が黙って並べ替えない）', () => {
    const output = validOutput();
    const footer = output.sections.pop()!;
    output.sections.splice(1, 0, footer);
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.reason.includes('footer-01 は末尾'))).toBe(true);
  });

  it('testimonials-01 の mode と items の形が食い違うと拒否される', () => {
    const output = validOutput();
    output.sections.splice(3, 0, {
      sectionType: 'testimonials-01',
      content: {
        heading: 'お客様の声',
        mode: 'beforeAfter',
        items: [
          { quote: '完全個室で落ち着けました。', author: 'A.M様', role: '30代 会社員' },
          { quote: '色の提案が的確でした。', author: 'R.K様', role: '40代 自営業' },
        ],
      },
    });
    const result = validateLlmOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections.some((r) => r.reason.includes('items の形が一致'))).toBe(true);
  });

  it('プレースホルダ（unknown 等）を本文に書くと拒否される', () => {
    for (const placeholder of ['unknown', '不明', 'TBD', '-', '未定']) {
      const output = validOutput();
      output.sections[0].content.phone = placeholder;
      const result = validateLlmOutput(output);
      expect(result.ok, `${placeholder} が通ってしまった`).toBe(false);
      if (result.ok) continue;
      expect(result.rejections.some((r) => r.reason.includes('プレースホルダ'))).toBe(true);
    }
  });

  it('連絡先は省略できる（省略なら拒否されない）', () => {
    const output = validOutput();
    delete output.sections[0].content.phone;
    expect(validateLlmOutput(output).ok).toBe(true);
  });

  it('JSON の形が根本的に違う場合も握りつぶさず拒否する', () => {
    expect(validateLlmOutput({ hello: 'world' }).ok).toBe(false);
    expect(validateLlmOutput(null).ok).toBe(false);
  });
});

describe('機械が組み立てで埋めるもの（LLM に決めさせない）', () => {
  function assembled() {
    const output = validOutput();
    output.sections[3].content.copyright = '© 2023 nail atelier reve';
    const result = validateLlmOutput(output);
    if (!result.ok) throw new Error(`許可されるはずが拒否された: ${JSON.stringify(result.rejections)}`);
    return assemblePage(result.value);
  }

  it('画像URLは機械が注入する（同じ入力なら同じURL＝決定的）', () => {
    const first = assembled();
    const second = assembled();
    const hero = first.sections.find((s) => s.sectionType === 'hero-01');
    expect(typeof hero?.content.imageUrl).toBe('string');
    expect(hero?.content.imageUrl).toBe(
      second.sections.find((s) => s.sectionType === 'hero-01')?.content.imageUrl,
    );

    const services = first.sections.find((s) => s.sectionType === 'services-01');
    const items = services?.content.items as Array<{ imageUrl?: string }>;
    expect(items.every((i) => typeof i.imageUrl === 'string')).toBe(true);
  });

  it('著作権の西暦は現在年へ機械が直す（LLM が古い年を書くため）', () => {
    const footer = assembled().sections.find((s) => s.sectionType === 'footer-01');
    expect(footer?.content.copyright).toContain(String(new Date().getFullYear()));
    expect(footer?.content.copyright).not.toContain('2023');
  });

  it('palette / motion が組み立て結果へ引き継がれる', () => {
    const page = assembled();
    expect(page.palette).toBe('light-gray');
    expect(page.motion).toBe('subtle');
  });
});

describe('プロンプト', () => {
  it('台帳の値がプロンプトに動的に埋め込まれる', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('typographic-kinetic');
    expect(prompt).toContain('warm-studio');
    expect(prompt).toContain('testimonials-01');
    expect(prompt).toContain('beforeAfter');
  });

  it('差し戻し文面に拒否理由がそのまま入る', () => {
    const retry = buildRetryPrompt([{ path: 'design.heroVariant', reason: '台帳にありません' }]);
    expect(retry).toContain('design.heroVariant');
    expect(retry).toContain('台帳にありません');
  });
});
