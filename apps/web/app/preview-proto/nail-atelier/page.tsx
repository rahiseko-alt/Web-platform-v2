import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import type { RenderableSection } from '@/db/queries/site-render';
import type { DesignSpec } from '@/templates/types';

/**
 * STEP1 ステップ2の使い捨てプロトタイプ。DB/API を経由せず、
 * 依頼文「渋谷で新しくオープンする、女性向けの隠れ家的なネイルサロンのサイト。
 * 落ち着いた大人っぽい雰囲気で、料金メニューと予約をしっかり見せたい。」に対して
 * Claude が直接生成した DesignSpec + セクションcontentをハードコードし、
 * 既存レンダラ（PageRenderer/SiteThemeProvider）にそのまま渡して一周させる。
 * マスターの感覚点とjudge採点の差分を見るための実験専用ルート。恒久実装ではない。
 */

const design: DesignSpec = {
  heroVariant: 'split-editorial',
  rhythm: 'loose',
  align: 'asymmetric',
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
      logo: 'nail atelier reve',
      navItems: [
        { label: 'MENU', href: '#services' },
        { label: 'ABOUT', href: '/about' },
        { label: 'ACCESS', href: '#contact' },
      ],
      ctaLabel: 'WEB予約',
      ctaHref: '#contact',
      phone: '03-6427-5510',
    },
  },
  {
    id: 'hero',
    sectionType: 'hero-01',
    order: 1,
    content: {
      badge: '完全予約制・お一人様専用の隠れ家サロン',
      title: '爪先から、静かに整う。',
      subtitle:
        '渋谷の喧騒から少し離れた隠れ家で、指先だけでなく心もほどける時間を。落ち着いた大人の女性のための、完全個室ネイルサロンです。',
      ctaLabel: 'WEB予約する',
      ctaHref: '#contact',
      secondaryLabel: '料金メニューを見る',
      secondaryHref: '#services',
      imageUrl: 'https://picsum.photos/seed/hideaway-nail-salon-interior/1600/1000',
      anchor: 'bottom-left',
    },
  },
  {
    id: 'services',
    sectionType: 'services-01',
    order: 2,
    content: {
      heading: 'MENU',
      intro: 'すべてのコースにハンドマッサージとパラフィンパックが含まれます。爪の状態を見ながら、無理のない一枚を提案します。',
      items: [
        {
          title: 'シンプルジェル一色',
          price: '¥7,700',
          description: '短時間で仕上がる、上品な一色仕上げ。オフィスにも馴染む定番コースです。',
          imageUrl: 'https://picsum.photos/seed/nail-salon-simple-gel/600/800',
        },
        {
          title: '大人の陰影フレンチ',
          price: '¥9,900',
          description: 'くすみカラーで仕上げる、主張しすぎない大人フレンチ。',
          imageUrl: 'https://picsum.photos/seed/nail-salon-french-elegant/600/800',
        },
        {
          title: 'ハンド磨き上げケア',
          price: '¥6,600',
          description: '甘皮・角質を丁寧に整え、素の指先の美しさを引き出す集中ケア。',
          imageUrl: 'https://picsum.photos/seed/nail-salon-hand-care/600/800',
        },
        {
          title: 'オフ+ワンカラー',
          price: '¥8,800',
          description: '他店のジェルオフから対応。付け替えも当日中に仕上げます。',
          imageUrl: 'https://picsum.photos/seed/nail-salon-color-change/600/800',
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
      intro: '「なんとなく落ち着く」を仕組みとして整えています。',
      items: [
        { title: '完全個室・お一人様専用', description: '他のお客様と顔を合わせない完全個室。予約枠は前後30分の余白を確保しています。' },
        { title: '指名率88%のネイリスト在籍', description: '色選びに迷う方にも、骨格や肌トーンから提案できる経験豊富なスタッフです。' },
        { title: '駅から徒歩3分の隠れ家立地', description: '大通りから一本入った、看板を出さない隠れ家。常連様中心にご紹介いただいています。' },
        { title: '夜21時までの遅め予約OK', description: '仕事帰りでも余裕を持って通える時間設定です。' },
      ],
    },
  },
  {
    id: 'stats',
    sectionType: 'stats-01',
    order: 4,
    content: {
      items: [
        { value: '88%', label: '指名リピート率（自社データ）' },
        { value: '300名+', label: '独立後の常連のお客様数' },
        { value: '3年', label: '開業からの年数' },
      ],
    },
  },
  {
    id: 'testimonials',
    sectionType: 'testimonials-01',
    order: 5,
    content: {
      heading: 'お客様の声',
      mode: 'quote',
      items: [
        { quote: '完全個室なので人目を気にせず、本当にリラックスできました。', author: 'A.M様', role: '30代 会社員' },
        { quote: '色選びに迷っていたら、肌の色に合わせて提案してくれて安心しました。', author: 'R.K様', role: '40代 自営業' },
        { quote: '夜遅くまで予約できるので、仕事帰りに無理なく通えています。', author: 'S.N様', role: '20代 会社員' },
      ],
    },
  },
  {
    id: 'cta',
    sectionType: 'cta-01',
    order: 6,
    content: {
      heading: '指先だけの、静かなご褒美を。',
      body: '完全個室・お一人様専用。WEB予約なら夜21時までの枠も確保できます。',
      ctaLabel: 'WEB予約する',
      ctaHref: '#contact',
      phone: '03-6427-5510',
    },
  },
  {
    id: 'footer',
    sectionType: 'footer-01',
    order: 7,
    content: {
      heading: 'nail atelier reve',
      ctaLabel: 'WEB予約する',
      ctaHref: '#contact',
      phone: '03-6427-5510',
      columns: [
        {
          title: 'MENU',
          links: [
            { label: 'ジェル一色', href: '#services' },
            { label: '大人フレンチ', href: '#services' },
            { label: 'ハンドケア', href: '#services' },
          ],
        },
        {
          title: 'SALON',
          links: [
            { label: 'オーナー紹介', href: '/about' },
            { label: 'アクセス', href: '#contact' },
            { label: 'よくある質問', href: '#faq' },
          ],
        },
      ],
      copyright: '© 2026 nail atelier reve',
    },
  },
];

export default function NailAtelierPrototypePage() {
  return (
    <SiteThemeProvider theme="minimal-corporate">
      <PageRenderer sections={sections} design={design} />
    </SiteThemeProvider>
  );
}
