import { describe, it, expect } from 'vitest';
import { generatePage } from '@/generate/generate';
import type { LlmClient } from '@/generate/llm/client';

/**
 * 稼働ループ（generate.ts）の検証。API キー・ネットワーク不要。
 * fake client がキュー先頭から応答を返すことで「差し戻して直る／直らない」を再現する。
 */

/** 契約を満たす最小の正常出力（generate-validate.test.ts と同型） */
function validOutputJson(): string {
  return JSON.stringify({
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
          subtitle:
            '渋谷の隠れ家で、指先だけでなく心もほどける時間を過ごせる完全個室のネイルサロンです。',
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
  });
}

/** キュー先頭から順に応答を返す fake。呼ばれた system/user は記録する */
function queuedClient(responses: string[]): LlmClient & { calls: Array<{ system: string; user: string }> } {
  const calls: Array<{ system: string; user: string }> = [];
  let i = 0;
  return {
    calls,
    async complete(system, user) {
      calls.push({ system, user });
      const res = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return res;
    },
  };
}

describe('稼働ループ generatePage', () => {
  it('初回で契約を満たせば1回で組み立てて返す', async () => {
    const client = queuedClient([validOutputJson()]);
    // 追加コール（字数伸ばし）はループの検証対象外なので切る。呼び出し回数を素で数える
    const result = await generatePage({ brief: '渋谷のネイルサロン' }, client, { expandLength: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(1);
    expect(result.page.sections.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    expect(result.page.sections[0].id).toBe('header-01-0');
    expect(client.calls).toHaveLength(1);
  });

  it('台帳外の出力は差し戻し、直った次の試行で成功する', async () => {
    const broken = JSON.parse(validOutputJson());
    broken.design.heroVariant = 'cinematic-parallax'; // 台帳に無い
    const client = queuedClient([JSON.stringify(broken), validOutputJson()]);

    const result = await generatePage({ brief: '渋谷のネイルサロン' }, client, { expandLength: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    // 差し戻し2回目の user プロンプトに拒否理由と前回出力が載っている
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].user).toContain('heroVariant');
    expect(client.calls[1].user).toContain('前回のあなたの出力');
  });

  it('JSON でない応答も握りつぶさず差し戻す', async () => {
    const client = queuedClient(['ここにデザイン案を書きました……', validOutputJson()]);
    const result = await generatePage({ brief: '渋谷のネイルサロン' }, client, { expandLength: false });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(client.calls[1].user).toContain('JSON');
  });

  it('上限まで直らなければ拒否理由を集約して失敗を返す', async () => {
    const broken = JSON.parse(validOutputJson());
    broken.theme = 'dark-luxury'; // 台帳に無い theme を出し続ける
    const client = queuedClient([JSON.stringify(broken)]);

    const result = await generatePage({ brief: '渋谷のネイルサロン' }, client, { maxRetries: 2, expandLength: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.attempts).toBe(3); // 初回 + 差し戻し2回
    expect(result.rejections.length).toBeGreaterThan(0);
    expect(client.calls).toHaveLength(3);
  });
});
