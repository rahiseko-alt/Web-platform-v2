import type { TemplateDefinition } from '@/templates/types';

/**
 * general-002: warm-studio テーマ。
 * general-001 と同じ共通コンポーネントを使い、順序差でcomposition柔軟性を示す。
 */
const generalTemplate002: TemplateDefinition = {
  templateId: 'general-002',
  category: 'professional-service',
  theme: 'warm-studio',
  // 構造化トークン: フルブリード非対称hero・詰まったリズム・非対称グリッド（緊張・温度寄り）
  design: {
    heroVariant: 'fullbleed-asymmetric',
    rhythm: 'tight',
    align: 'asymmetric',
    // services は横スクロールレール、cta は画像スプリット（general-001 と骨格を意図的にずらす）
    sectionVariants: {
      'services-01': 'horizontal-rail',
      'cta-01': 'split-media',
    },
  },
  pages: [
    {
      slug: '/',
      sections: [
        'header-01',
        'hero-01',
        'features-01',
        'services-01',
        'stats-01',
        'cta-01',
        'testimonials-01',
        'footer-01',
      ],
    },
    {
      slug: 'about',
      sections: ['header-01', 'about-01', 'contact-01', 'process-01', 'faq-01', 'footer-01'],
    },
  ],
};

export default generalTemplate002;
