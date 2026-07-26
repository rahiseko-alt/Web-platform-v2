import { describe, it, expect } from 'vitest';
import { expandShortFields } from '@/generate/expand-length';
import { charLength, enumerateLeaves } from '@/generate/length-rules';
import { validateLlmOutput } from '@/generate/validate';
import type { LlmOutput } from '@/generate/types';
import type { LlmClient } from '@/generate/llm/client';

/**
 * 下限割れ限定の追加コール（expand-length.ts）の検証。LLM・ネットワーク不要。
 * fake client が固定応答/例外を返すことで、採用・不採用の分岐を決定的に再現する。
 */

/** 呼び出し回数を数える fake。complete は固定応答を返すか、指定なら例外を投げる */
function fakeClient(response: string | (() => never)): LlmClient & { calls: number } {
  return {
    calls: 0,
    async complete() {
      this.calls += 1;
      if (typeof response === 'function') return response();
      return response;
    },
  };
}

/**
 * 既知の正常構造（generate-loop.test.ts と同型）を土台に、
 * subtitle と services の説明文だけ差し替えて LlmOutput を作る。
 * validateLlmOutput を通すことで「テスト土台自体が有効」を保証する。
 */
function makeOutput(subtitle: string, descriptions: [string, string, string]): LlmOutput {
  const raw = {
    design: {
      heroVariant: 'split-editorial',
      rhythm: 'loose',
      align: 'asymmetric',
      sectionVariants: { 'services-01': 'editorial-index' },
    },
    theme: 'minimal-corporate',
    palette: 'theme-default',
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
          subtitle,
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
            { title: 'シンプルジェル', price: '¥7,700', description: descriptions[0], imageUrl: 'https://example.test/a.jpg' },
            { title: '大人フレンチ', price: '¥9,900', description: descriptions[1], imageUrl: 'https://example.test/b.jpg' },
            { title: 'ハンドケア', price: '¥6,600', description: descriptions[2], imageUrl: 'https://example.test/c.jpg' },
          ],
        },
      },
      {
        sectionType: 'footer-01',
        content: {
          columns: [{ title: 'MENU', links: [{ label: 'ジェル', href: '#services' }, { label: 'ケア', href: '#services' }] }],
          copyright: '© 2026 nail atelier reve',
        },
      },
    ],
    needs_review: false,
    unknowns: [],
  };

  const result = validateLlmOutput(raw);
  if (!result.ok) throw new Error(`テスト土台が不正: ${JSON.stringify(result.rejections)}`);
  return result.value;
}

// 規定を満たす長さ（hero.subtitle 60〜120 / services desc 40〜70）
const SUBTITLE_LONG =
  '渋谷駅からほど近い完全予約制の隠れ家サロンで、指先の美しさだけでなく日々の疲れまでやわらかくほどける特別なひとときを、あなたのために丁寧にご用意しています。';
const DESC_LONG = 'くすみカラーを基調にした大人のためのフレンチネイルを、爪の形に合わせて一本ずつ時間をかけて丁寧に仕上げます。';
// 下限割れ
const SUBTITLE_SHORT = '指先を静かに整えます。';
const DESC_SHORT = '上品な一色仕上げ。';

describe('enumerateLeaves のアドレス', () => {
  it('配列 items[] を要素ごとの具体パスで列挙し、set で書き戻せる', () => {
    const content = { items: [{ description: 'a' }, { description: 'b' }] };
    const leaves = enumerateLeaves(content, ['items[]', 'description'], 'services-01');

    expect(leaves.map((l) => l.path)).toEqual([
      'services-01.items[0].description',
      'services-01.items[1].description',
    ]);
    leaves[1].set('B');
    expect(content.items[1].description).toBe('B');
    expect(content.items[0].description).toBe('a'); // 別要素を巻き込まない
  });

  it('入れ子でない単一フィールドも basePath 起点の具体パスになる', () => {
    const content = { subtitle: 'x' };
    const leaves = enumerateLeaves(content, ['subtitle'], 'hero-01');
    expect(leaves).toHaveLength(1);
    expect(leaves[0].path).toBe('hero-01.subtitle');
    leaves[0].set('y');
    expect(content.subtitle).toBe('y');
  });

  it('空 segments では throw せず空配列を返す（旧 valuesAtPath 相当）', () => {
    expect(enumerateLeaves({ subtitle: 'x' }, [])).toEqual([]);
  });
});

describe('expandShortFields', () => {
  it('全項目が規定内なら追加コールしない（課金ゼロ）', async () => {
    expect(charLength(SUBTITLE_LONG)).toBeGreaterThanOrEqual(60);
    expect(charLength(DESC_LONG)).toBeGreaterThanOrEqual(40);

    const output = makeOutput(SUBTITLE_LONG, [DESC_LONG, DESC_LONG, DESC_LONG]);
    const client = fakeClient('{}');
    const result = await expandShortFields(output, '渋谷のネイルサロン', client);

    expect(client.calls).toBe(0);
    expect(result.expanded).toBe(false);
    expect(result.output).toBe(output); // 元をそのまま返す
  });

  it('下限割れフィールドを1回のコールで伸ばし、正しいパスへ書き戻す', async () => {
    expect(charLength(SUBTITLE_SHORT)).toBeLessThan(60);
    expect(charLength(DESC_SHORT)).toBeLessThan(40);

    const output = makeOutput(SUBTITLE_SHORT, [DESC_SHORT, DESC_SHORT, DESC_SHORT]);
    const replacements = JSON.stringify({
      'hero-01.subtitle': SUBTITLE_LONG,
      'services-01.items[0].description': DESC_LONG,
      'services-01.items[1].description': DESC_LONG,
      'services-01.items[2].description': DESC_LONG,
    });
    const client = fakeClient(replacements);
    const result = await expandShortFields(output, '渋谷のネイルサロン', client);

    expect(client.calls).toBe(1);
    expect(result.expanded).toBe(true);

    const hero = result.output.sections.find((s) => s.sectionType === 'hero-01');
    expect((hero!.content as { subtitle: string }).subtitle).toBe(SUBTITLE_LONG);
    const services = result.output.sections.find((s) => s.sectionType === 'services-01');
    const items = (services!.content as { items: Array<{ description: string }> }).items;
    expect(items[0].description).toBe(DESC_LONG);
    expect(items[2].description).toBe(DESC_LONG);

    // 元 output は書き換わっていない（clone に対して作業している）
    const heroOrig = output.sections.find((s) => s.sectionType === 'hero-01');
    expect((heroOrig!.content as { subtitle: string }).subtitle).toBe(SUBTITLE_SHORT);
  });

  it('プレースホルダの書き換えは採用しない', async () => {
    const output = makeOutput(SUBTITLE_SHORT, [DESC_LONG, DESC_LONG, DESC_LONG]);
    const client = fakeClient(JSON.stringify({ 'hero-01.subtitle': '不明' }));
    const result = await expandShortFields(output, 'brief', client);

    expect(client.calls).toBe(1); // 下限割れがあるので呼ぶが
    expect(result.expanded).toBe(false); // 採用はしない
    expect(result.output).toBe(output);
  });

  it('元より短い/同じ長さの書き換えは採用しない', async () => {
    const output = makeOutput(SUBTITLE_SHORT, [DESC_LONG, DESC_LONG, DESC_LONG]);
    const client = fakeClient(JSON.stringify({ 'hero-01.subtitle': '短い。' }));
    const result = await expandShortFields(output, 'brief', client);

    expect(result.expanded).toBe(false);
    expect(result.output).toBe(output);
  });

  it('JSON でない応答・非文字列の値は握りつぶさず元を保持する', async () => {
    const output = makeOutput(SUBTITLE_SHORT, [DESC_LONG, DESC_LONG, DESC_LONG]);

    const bad = fakeClient('ここに提案を書きました……');
    const r1 = await expandShortFields(output, 'brief', bad);
    expect(r1.expanded).toBe(false);
    expect(r1.output).toBe(output);

    const nonString = fakeClient(JSON.stringify({ 'hero-01.subtitle': 123 }));
    const r2 = await expandShortFields(output, 'brief', nonString);
    expect(r2.expanded).toBe(false);
    expect(r2.output).toBe(output);
  });

  it('追加コールが例外を投げても元を保持する（ページを落とさない）', async () => {
    const output = makeOutput(SUBTITLE_SHORT, [DESC_LONG, DESC_LONG, DESC_LONG]);
    const throwing = fakeClient(() => {
      throw new Error('LLM 呼び出し失敗');
    });
    const result = await expandShortFields(output, 'brief', throwing);

    expect(result.expanded).toBe(false);
    expect(result.output).toBe(output);
  });
});
