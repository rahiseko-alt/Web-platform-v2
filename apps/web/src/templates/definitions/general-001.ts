import type { TemplateDefinition } from '@/templates/types';

/**
 * general-001: minimal-corporate テーマ。
 * JSON設定データ（ページ構成×セクション種別）のみでテンプレートを表現し、HTML複製をしない。
 */
const generalTemplate001: TemplateDefinition = {
  templateId: 'general-001',
  category: 'professional-service',
  theme: 'minimal-corporate',
  // 構造化トークン: 非対称2カラムhero・ゆったりリズム・非対称グリッド（端正・品位寄り）
  design: {
    heroVariant: 'split-editorial',
    rhythm: 'loose',
    align: 'asymmetric',
    // services は縦エディトリアル索引、cta は中央帯（general-002 と骨格を意図的にずらす）
    sectionVariants: {
      'services-01': 'editorial-index',
      'cta-01': 'centered',
    },
  },
  pages: [
    {
      slug: '/',
      sections: [
        'header-01',
        'hero-01',
        'services-01',
        'features-01',
        'stats-01',
        'testimonials-01',
        'cta-01',
        'footer-01',
      ],
    },
    {
      slug: 'about',
      sections: ['header-01', 'about-01', 'process-01', 'faq-01', 'contact-01', 'footer-01'],
    },
  ],
};

export default generalTemplate001;
