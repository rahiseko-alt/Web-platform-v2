/**
 * 契約を満たす最小の正常出力（LLM の生応答を模した JSON 文字列）。
 *
 * 稼働ループを通す必要があるテストが複数あるため、同じ JSON をテストごとに写経せず
 * ここ1箇所に置く。個別の検証で崩したい場合は JSON.parse して書き換えてから使う。
 */
export function validLlmOutputJson(): string {
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
