import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import type { RenderableSection } from '@/db/queries/site-render';
import type { DesignSpec } from '@/templates/types';

/**
 * STEP1 ステップ2の使い捨てプロトタイプ（3件目）。依頼文:
 * 「創業70年の老舗和菓子店の公式サイト。伝統と品格を大事にした落ち着いた高級感を
 * 出したい。季節の商品と、贈答用の注文をしっかり見せたい。」
 * nail-atelier（隠れ家/非対称）・body-forge（勢い/非対称）との対比用（align=centered）。
 * 恒久実装ではない。
 */

const design: DesignSpec = {
  heroVariant: 'split-editorial',
  rhythm: 'loose',
  align: 'centered',
  sectionVariants: {
    'services-01': 'editorial-index',
    'cta-01': 'centered',
  },
};

const sections: RenderableSection[] = [
  {
    id: 'header',
    sectionType: 'header-01',
    order: 0,
    content: {
      logo: '一枝庵',
      navItems: [
        { label: '商品案内', href: '#services' },
        { label: '当店について', href: '/about' },
        { label: 'アクセス', href: '#contact' },
      ],
      ctaLabel: 'ご注文はこちら',
      ctaHref: '#contact',
      phone: '03-3987-6543',
    },
  },
  {
    id: 'hero',
    sectionType: 'hero-01',
    order: 1,
    content: {
      badge: '創業70年・四代続く和菓子の手仕事',
      title: '季節を、ひと口に込めて。',
      subtitle:
        '厳選した素材と昔ながらの製法で、一つひとつ手作業でお作りしています。季節の上生菓子から、贈答用の詰め合わせまで。',
      ctaLabel: 'ご注文はこちら',
      ctaHref: '#contact',
      secondaryLabel: '商品を見る',
      secondaryHref: '#services',
      imageUrl: 'https://picsum.photos/seed/japanese-wagashi-confection-craft/1600/1000',
      anchor: 'bottom-left',
    },
  },
  {
    id: 'services',
    sectionType: 'services-01',
    order: 2,
    content: {
      heading: '商品案内',
      intro: '季節限定品と定番の詰め合わせをご用意しております。のし・包装も承ります。',
      items: [
        {
          title: '季節の上生菓子 5個入',
          price: '¥3,240',
          description: '職人が季節の情景を表現した上生菓子の詰め合わせ。贈答にも人気です。',
          imageUrl: 'https://picsum.photos/seed/wagashi-seasonal-set-gift/600/800',
        },
        {
          title: '献上羊羹',
          price: '¥2,700',
          description: '厳選小豆を使い、三日間かけて練り上げる看板商品です。',
          imageUrl: 'https://picsum.photos/seed/yokan-traditional-sweet/600/800',
        },
        {
          title: '手土産どら焼き 6個入',
          price: '¥1,944',
          description: '注文を受けてから一枚ずつ焼き上げる、しっとりとした生地が自慢です。',
          imageUrl: 'https://picsum.photos/seed/dorayaki-japanese-pancake/600/800',
        },
        {
          title: '慶事・法事お詰め合わせ',
          price: '¥5,400〜',
          description: '用途に応じてのし・包装紙をお選びいただけます。',
          imageUrl: 'https://picsum.photos/seed/japanese-gift-box-wrapping/600/800',
        },
      ],
    },
  },
  {
    id: 'features',
    sectionType: 'features-01',
    order: 3,
    content: {
      heading: '選ばれる理由',
      intro: '「変わらない味」を守るための、変わらない手間があります。',
      items: [
        { title: '四代続く手作りの製法', description: '機械に頼らず、熟練の職人が一つひとつ手作業で仕上げます。' },
        { title: '着色料・保存料不使用', description: '素材本来の色と味を大切にしています。' },
        { title: 'のし・包装の無料対応', description: '慶事・弔事それぞれの作法に合わせてお包みします。' },
        { title: '全国発送対応', description: '贈答用の熨斗付き発送も承っております。' },
      ],
    },
  },
  {
    id: 'about',
    sectionType: 'about-01',
    order: 4,
    content: {
      heading: '四代目より',
      body: '四代目 田中 一心（仮名）。祖父の代から受け継ぐ製法を守りながら、季節ごとの上生菓子のデザインを手掛けています。「変わらないために、手間を惜しまない」を信条としています。',
      imageUrl: 'https://picsum.photos/seed/wagashi-craftsman-portrait/1200/1400',
      credentials: ['全国和菓子協会 会員', '創業70年 四代目', '年間上生菓子デザイン 40種以上'],
    },
  },
  {
    id: 'stats',
    sectionType: 'stats-01',
    order: 5,
    content: {
      items: [
        { value: '70年', label: '創業からの年数' },
        { value: '4代', label: '継承する代数' },
        { value: '40種+', label: '年間の上生菓子デザイン数' },
      ],
    },
  },
  {
    id: 'testimonials',
    sectionType: 'testimonials-01',
    order: 6,
    content: {
      heading: 'お客様の声',
      mode: 'quote',
      items: [
        { quote: '法事の引き出物にお願いしましたが、丁寧な対応で助かりました。', author: 'M.I様', role: '50代' },
        { quote: '季節ごとの上生菓子が本当に美しく、手土産に重宝しています。', author: 'Y.T様', role: '40代' },
        { quote: '羊羹の味が昔と変わらず、実家に贈ると喜ばれます。', author: 'K.S様', role: '60代' },
      ],
    },
  },
  {
    id: 'cta',
    sectionType: 'cta-01',
    order: 7,
    content: {
      heading: '大切な方への贈り物に、季節の一枝を。',
      body: 'のし・包装は無料。慶事・弔事どちらにも対応いたします。',
      ctaLabel: 'ご注文はこちら',
      ctaHref: '#contact',
      phone: '03-3987-6543',
    },
  },
  {
    id: 'footer',
    sectionType: 'footer-01',
    order: 8,
    content: {
      heading: '一枝庵',
      ctaLabel: 'ご注文はこちら',
      ctaHref: '#contact',
      phone: '03-3987-6543',
      columns: [
        {
          title: '商品案内',
          links: [
            { label: '上生菓子', href: '#services' },
            { label: '羊羹', href: '#services' },
            { label: '詰め合わせ', href: '#services' },
          ],
        },
        {
          title: '当店について',
          links: [
            { label: '四代目紹介', href: '/about' },
            { label: 'アクセス', href: '#contact' },
            { label: 'よくある質問', href: '#faq' },
          ],
        },
      ],
      copyright: '© 2026 一枝庵',
    },
  },
];

export default function IchishiAnPrototypePage() {
  return (
    <SiteThemeProvider theme="minimal-corporate">
      <PageRenderer sections={sections} design={design} />
    </SiteThemeProvider>
  );
}
