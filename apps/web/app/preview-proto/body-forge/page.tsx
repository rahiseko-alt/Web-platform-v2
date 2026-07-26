import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import type { RenderableSection } from '@/db/queries/site-render';
import type { DesignSpec } from '@/templates/types';

/**
 * STEP1 ステップ2の使い捨てプロトタイプ（2件目）。依頼文:
 * 「都内で3店舗展開している、勢いのあるパーソナルジムのサイト。熱量高く、
 * 結果にコミットする感じを出したい。体験申込みと料金プランをしっかり見せたい。」
 * nail-atelier（1件目・隠れ家/落ち着き）との対比用。恒久実装ではない。
 */

const design: DesignSpec = {
  heroVariant: 'fullbleed-asymmetric',
  rhythm: 'tight',
  align: 'asymmetric',
  sectionVariants: {
    'services-01': 'horizontal-rail',
    'cta-01': 'split-media',
  },
};

const sections: RenderableSection[] = [
  {
    id: 'header',
    sectionType: 'header-01',
    order: 0,
    content: {
      logo: 'BODY FORGE',
      navItems: [
        { label: 'PLAN', href: '#services' },
        { label: 'RESULTS', href: '/about' },
        { label: 'ACCESS', href: '#contact' },
      ],
      ctaLabel: '無料体験',
      ctaHref: '#contact',
      phone: '03-4455-8899',
    },
  },
  {
    id: 'hero',
    sectionType: 'hero-01',
    order: 1,
    content: {
      badge: '都内3店舗・累計成約者数2,400名突破',
      title: '結果は、言い訳より雄弁だ。',
      subtitle:
        '週2回・完全個室のマンツーマン指導で、あなたの体を本気で変える。栄養指導までワンストップでコミットします。',
      ctaLabel: '無料カウンセリングを予約',
      ctaHref: '#contact',
      secondaryLabel: '料金プランを見る',
      secondaryHref: '#services',
      imageUrl: 'https://picsum.photos/seed/personal-gym-training-session/1600/1000',
      anchor: 'top-right',
    },
  },
  {
    id: 'features',
    sectionType: 'features-01',
    order: 2,
    content: {
      heading: '選ばれる理由',
      intro: '「なんとなく通う」を終わらせる仕組みです。',
      items: [
        { title: '専属トレーナー制', description: '契約期間中は同じトレーナーが最後まで担当します。' },
        { title: '管理栄養士監修の食事指導', description: 'LINEで毎日の食事を報告、栄養士がフィードバックします。' },
        { title: '成約者数2,400名超の実績', description: '3店舗合計の累計データに基づくプログラム設計です。' },
        { title: '全店舗 完全個室', description: '他の会員と顔を合わせず、集中して取り組めます。' },
      ],
    },
  },
  {
    id: 'services',
    sectionType: 'services-01',
    order: 3,
    content: {
      heading: 'PLAN',
      intro: '全プラン初回カウンセリング・体組成測定無料。専属トレーナーが最後まで伴走します。',
      items: [
        {
          title: '2ヶ月集中コース',
          price: '¥198,000',
          description: '週2回×16回。トレーニング+食事指導のフルサポート。',
          imageUrl: 'https://picsum.photos/seed/gym-training-course-intensive/600/800',
        },
        {
          title: '3ヶ月スタンダード',
          price: '¥268,000',
          description: '週2回×24回。リバウンド対策の維持期指導込み。',
          imageUrl: 'https://picsum.photos/seed/gym-training-standard-plan/600/800',
        },
        {
          title: '単発パーソナル',
          price: '¥8,800/回',
          description: 'まずは1回から。フォームチェックだけの利用もOK。',
          imageUrl: 'https://picsum.photos/seed/gym-single-session-training/600/800',
        },
        {
          title: 'ペア割プラン',
          price: '¥178,000/人',
          description: '友人・パートナーと一緒に。2ヶ月コースが1人あたり割引に。',
          imageUrl: 'https://picsum.photos/seed/gym-pair-training-plan/600/800',
        },
      ],
    },
  },
  {
    id: 'stats',
    sectionType: 'stats-01',
    order: 4,
    content: {
      items: [
        { value: '2,400名+', label: '累計成約者数（自社データ）' },
        { value: '92%', label: '目標達成率（自社アンケート）' },
        { value: '3店舗', label: '都内展開店舗数' },
      ],
    },
  },
  {
    id: 'cta',
    sectionType: 'cta-01',
    order: 5,
    content: {
      heading: '次の3ヶ月で、数字を変える。',
      body: '無料カウンセリングで、あなた専用のプログラムをご提案します。',
      ctaLabel: '無料カウンセリングを予約',
      ctaHref: '#contact',
      phone: '03-4455-8899',
      imageUrl: 'https://picsum.photos/seed/gym-interior-training-space/1600/900',
    },
  },
  {
    id: 'testimonials',
    sectionType: 'testimonials-01',
    order: 6,
    content: {
      heading: '会員の声',
      mode: 'quote',
      items: [
        { quote: '3ヶ月で体脂肪率が8%落ちました。数値で見えるのがモチベーションになります。', author: 'T.O様', role: '30代 会社員' },
        { quote: '食事指導が具体的で続けやすかったです。', author: 'H.Y様', role: '20代 会社員' },
        { quote: '専属トレーナーだったので毎回の説明が要らず効率的でした。', author: 'K.M様', role: '40代 経営者' },
      ],
    },
  },
  {
    id: 'footer',
    sectionType: 'footer-01',
    order: 7,
    content: {
      heading: 'BODY FORGE',
      ctaLabel: '無料カウンセリングを予約',
      ctaHref: '#contact',
      phone: '03-4455-8899',
      columns: [
        {
          title: 'PLAN',
          links: [
            { label: '2ヶ月集中', href: '#services' },
            { label: '3ヶ月スタンダード', href: '#services' },
            { label: '単発パーソナル', href: '#services' },
          ],
        },
        {
          title: 'GYM',
          links: [
            { label: 'トレーナー紹介', href: '/about' },
            { label: 'アクセス', href: '#contact' },
            { label: 'よくある質問', href: '#faq' },
          ],
        },
      ],
      copyright: '© 2026 BODY FORGE',
    },
  },
];

export default function BodyForgePrototypePage() {
  return (
    <SiteThemeProvider theme="warm-studio">
      <PageRenderer sections={sections} design={design} />
    </SiteThemeProvider>
  );
}
