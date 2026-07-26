import { describe, it, expect } from 'vitest';
import { LENGTH_RULES, PER_PAGE_TOTAL, WEIGHTS } from '@/eval/rubric';
import { scorePage } from '@/eval/score';
import { buildMatrixMarkdown, buildRun } from '@/eval/report';
import type { GeneratedPage } from '@/generate/types';

/**
 * 満点 fixture を1点だけ壊し、「壊した項目だけが減点される」ことを数値で確かめる。
 * 依頼文と本文は対応させてある（A: 特徴語 渋谷 / 料金 / 予約 / ネイルサロン が全て本文にある）。
 */
const BRIEF = '渋谷のネイルサロンのサイト。料金と予約を見せたい。';

const FILLER = 'ていねいなカウンセリングと施術で、はじめての方にも安心してお過ごしいただけます。';

/** 文字数レンジの検証を確実にするため、fixture の本文は目標文字数ちょうどに揃える */
function sized(head: string, target: number): string {
  let out = head;
  while ([...out].length < target) out += FILLER;
  return [...out].slice(0, target).join('');
}

function perfectPage(): GeneratedPage {
  const year = new Date().getFullYear();
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
    needsReview: false,
    unknowns: [],
    sections: [
      {
        id: 'header-01-0',
        sectionType: 'header-01',
        order: 0,
        content: {
          logo: '渋谷ネイルサロン reve',
          navItems: [
            { label: 'メニュー', href: '#services' },
            { label: 'アクセス', href: '#contact' },
          ],
          ctaLabel: 'ご予約',
          ctaHref: '#contact',
        },
      },
      {
        id: 'hero-01-1',
        sectionType: 'hero-01',
        order: 1,
        content: {
          badge: '渋谷駅から徒歩5分の隠れ家サロン',
          title: '渋谷の隠れ家ネイルサロン',
          subtitle: sized('爪の形と生活習慣を伺い、一人ひとりに合うデザインをご提案します。', 90),
          ctaLabel: 'ご予約はこちら',
          ctaHref: '#contact',
          secondaryLabel: '料金を見る',
          secondaryHref: '#services',
          anchor: 'bottom-left',
        },
      },
      {
        id: 'services-01-2',
        sectionType: 'services-01',
        order: 2,
        content: {
          heading: '料金メニュー',
          items: [
            { title: 'ベーシックケア', price: '¥7,700', description: sized('自爪をいたわるケアを中心にした基本のコースです。', 55) },
            { title: 'ワンカラー', price: '¥9,900', description: sized('単色で仕上げる定番のデザインコースです。', 55) },
            { title: 'アートコース', price: '¥13,200', description: sized('季節に合わせた繊細なアートを描くコースです。', 55) },
          ],
        },
      },
      {
        id: 'contact-01-3',
        sectionType: 'contact-01',
        order: 3,
        content: { heading: 'ご予約・お問い合わせ', ctaLabel: '予約する' },
      },
      {
        id: 'footer-01-4',
        sectionType: 'footer-01',
        order: 4,
        content: {
          columns: [
            {
              title: 'メニュー',
              links: [
                { label: '料金', href: '#services' },
                { label: '予約', href: '#contact' },
              ],
            },
          ],
          copyright: `© ${year} 渋谷ネイルサロン reve`,
        },
      },
    ],
  };
}

/** 壊した項目以外が満点のままであることを確認する */
function expectOnlyDropped(page: GeneratedPage, brief: string, dropped: keyof typeof WEIGHTS): void {
  const score = scorePage(brief, page);
  expect(score.details[dropped].score).toBeLessThan(WEIGHTS[dropped]);
  for (const key of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
    if (key === dropped) continue;
    expect(score.details[key].score, `${key} は満点のままであるべき`).toBe(WEIGHTS[key]);
  }
}

describe('rubric', () => {
  it('section-schemas の describe から文字数レンジを 8 件抽出する（表記が変わったら落ちる）', () => {
    expect(LENGTH_RULES.length).toBe(8);
    expect(LENGTH_RULES.find((rule) => rule.path === 'hero-01.subtitle')).toEqual({
      path: 'hero-01.subtitle',
      min: 60,
      max: 120,
    });
    expect(LENGTH_RULES.find((rule) => rule.path === 'services-01.items[].description')).toEqual({
      path: 'services-01.items[].description',
      min: 40,
      max: 70,
    });
  });

  it('「20字前後」のような非レンジ表記は拾わない', () => {
    expect(LENGTH_RULES.some((rule) => rule.path === 'hero-01.title')).toBe(false);
  });
});

describe('scorePage', () => {
  it('満点 fixture は 50/50', () => {
    const score = scorePage(BRIEF, perfectPage());
    expect(score.max).toBe(PER_PAGE_TOTAL);
    expect(score.total).toBe(50);
  });

  it('A: 依頼文の特徴語が本文に無いと依頼文反映だけが減る', () => {
    expectOnlyDropped(perfectPage(), `${BRIEF} 銀座からの移転で、着物の似合う雰囲気にしたい。`, 'brief');
  });

  it('B: 規定より長い本文があると文字数だけが減る', () => {
    const page = perfectPage();
    page.sections[1].content.subtitle = sized('爪の形と生活習慣を伺い、一人ひとりに合うデザインをご提案します。', 200);
    expectOnlyDropped(page, BRIEF, 'length');
  });

  it('C: CTA 到達手段が無いと構成だけが減る', () => {
    const page = perfectPage();
    page.sections = page.sections.filter((section) => section.sectionType !== 'contact-01');
    expectOnlyDropped(page, BRIEF, 'structure');
  });

  it('D: unknowns に挙げた電話番号が本文にあると誠実性だけが減る', () => {
    const page = perfectPage();
    page.unknowns = ['電話番号が依頼文にありません'];
    page.sections[0].content.phone = '03-1234-5678';
    expectOnlyDropped(page, BRIEF, 'honesty');
  });

  it('E: 同じ本文を使い回すと非重複だけが減る', () => {
    const page = perfectPage();
    const items = page.sections[2].content.items as Array<{ description: string }>;
    items[1].description = items[0].description;
    expectOnlyDropped(page, BRIEF, 'variety');
  });

  it('依頼文の明示要求に応えるセクションが無いと構成が減る', () => {
    const page = perfectPage();
    page.sections = page.sections.filter((section) => section.sectionType !== 'services-01');
    const score = scorePage('渋谷のネイルサロン。料金をしっかり見せたい。', page);
    expect(score.details.structure.score).toBeLessThan(WEIGHTS.structure);
    expect(score.details.structure.notes.join()).toContain('料金・メニュー');
  });

  it('根拠が無いのに stats-01 を使うと誠実性が減る', () => {
    const page = perfectPage();
    page.sections.splice(3, 0, {
      id: 'stats-01-9',
      sectionType: 'stats-01',
      order: 9,
      content: { items: [{ value: '98%', label: 'リピート率' }, { value: '300名+', label: '施術実績' }] },
    });
    const score = scorePage(BRIEF, page);
    expect(score.details.honesty.score).toBe(WEIGHTS.honesty - 2);
  });
});

describe('buildRun / buildMatrixMarkdown', () => {
  it('3件からマトリクスを生成し、平均行と合計を出す', () => {
    const run = buildRun([
      { brief: BRIEF, page: perfectPage(), attempts: 1 },
      { brief: BRIEF, page: perfectPage(), attempts: 2 },
      { brief: BRIEF, failure: '機械制御ゲートで拒否' },
    ]);

    expect(run.generated).toEqual({ ok: 2, total: 3 });
    expect(run.averagePerPage).toBe(50);
    expect(run.machineMax).toBe(60);

    const markdown = buildMatrixMarkdown(run);
    expect(markdown).toContain('A 依頼文反映');
    expect(markdown).toContain('**平均**');
    expect(markdown).toContain('生成失敗');
    expect(markdown.split('\n').filter((line) => line.startsWith('| 1.') || line.startsWith('| 2.') || line.startsWith('| 3.')).length).toBe(3);
  });
});
