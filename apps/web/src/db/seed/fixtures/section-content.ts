/**
 * templateId（general-001/general-002）× sectionType（12種）→ サンプルcontent のマップ。
 * docs/design-notes.md §8 のデモ2エグゼンプラ（架空店舗・実在店舗名/人物名は使わない）:
 * - general-001 = あおば歯科・矯正クリニック（信頼シグナル・WEB予約24時間・院長紹介）
 * - general-002 = salon lumi（世界観・仕上がり・営業時間外WEB予約）
 * 各keyは対応するblock（src/sections/blocks/*.tsx）が読むcontent構造に厳密に合わせている。
 * 画像は https://picsum.photos/seed/<topical-word>/<w>/<h> を使用（実写真・確実に200が返る）。
 */
export type SectionContentMap = Record<string, Record<string, unknown>>;

const clinicContent: SectionContentMap = {
  'header-01': {
    logo: 'あおば歯科・矯正クリニック',
    navItems: [
      { label: '診療案内', href: '#services' },
      { label: '医院紹介', href: '/about' },
      { label: 'アクセス', href: '#contact' },
    ],
    ctaLabel: 'WEB予約',
    ctaHref: '#contact',
    phone: '03-5678-1234',
  },
  'hero-01': {
    badge: 'WEB予約は24時間受付・当日キャンセルもOK',
    title: '痛くなる前に、通いたくなる歯医者へ。',
    subtitle:
      '虫歯治療から矯正まで、麻酔にもこだわる痛みの少ない治療をご提供。初診はWEBから60秒で予約できます。',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    secondaryLabel: '診療案内を見る',
    secondaryHref: '#services',
    imageUrl: 'https://picsum.photos/seed/aoba-dental-clinic-interior/1600/1000',
    anchor: 'bottom-left',
  },
  'services-01': {
    heading: '診療案内',
    intro: '保険診療から自由診療まで、症状とご希望に合わせて選べます。',
    items: [
      {
        title: '一般診療・虫歯治療',
        price: '保険診療 3割負担',
        description:
          'なるべく削らない・痛みの少ない治療を徹底。初診当日の応急処置にも対応します。',
        imageUrl: 'https://picsum.photos/seed/dental-general-treatment/600/800',
      },
      {
        title: 'マウスピース矯正',
        price: '月々9,800円〜（分割）',
        description:
          '透明な装置で目立たず矯正。3Dシミュレーションで完了までの見た目を事前確認できます。',
        imageUrl: 'https://picsum.photos/seed/clear-aligner-orthodontics/600/800',
      },
      {
        title: 'ホワイトニング',
        price: '1回 8,800円〜',
        description: '即日で歯を明るく。オフィス・ホームの2種類からライフスタイルで選べます。',
        imageUrl: 'https://picsum.photos/seed/teeth-whitening-treatment/600/800',
      },
      {
        title: '小児歯科',
        price: '保険診療',
        description: 'キッズスペース完備。歯医者嫌いにさせない、褒めて伸ばす診療を大切にしています。',
        imageUrl: 'https://picsum.photos/seed/pediatric-dentistry-kids/600/800',
      },
    ],
  },
  'features-01': {
    heading: '選ばれる4つの理由',
    intro: '「なんとなく怖い」を無くす仕組みを整えています。',
    items: [
      { title: '無痛治療へのこだわり', description: '電動麻酔器と表面麻酔で刺す痛みを最小限に。' },
      { title: '土日診療・当日予約対応', description: '平日忙しい方も通いやすい診療体制です。' },
      { title: '院内感染対策 認定', description: '滅菌パック管理・グローブ患者ごと交換を徹底。' },
      { title: '説明重視のカウンセリング', description: '治療前に画像で状態と選択肢を必ず共有します。' },
    ],
  },
  'about-01': {
    heading: '院長紹介',
    body: '院長 高橋 誠一郎（仮名）。日本歯科大学卒業後、都内総合病院での勤務を経て2014年に開業。「怖くない歯医者」を目指し、年間150時間以上の臨床研修を継続しています。',
    imageUrl: 'https://picsum.photos/seed/dentist-portrait-clinic/1200/1400',
    credentials: ['日本歯科保存学会 会員', 'インプラント学会 認定医', '年間症例数 1,200件以上'],
  },
  'stats-01': {
    items: [
      { value: '1,200件+', label: '年間治療実績（自院データ）' },
      { value: '94%', label: '症例後アンケート満足度' },
      { value: '11年', label: '開業からの年数' },
    ],
  },
  'process-01': {
    heading: '初診の流れ',
    steps: [
      { no: '01', title: 'WEB予約', description: '24時間いつでもWEBから空き状況を確認し予約できます。' },
      {
        no: '02',
        title: 'カウンセリング・検査',
        description: '口腔内カメラとレントゲンで現状を可視化しながらご説明します。',
      },
      { no: '03', title: '治療計画のご提案', description: '費用と期間を明示した計画書をその場でお渡しします。' },
      { no: '04', title: '治療開始', description: 'ご納得いただいてから治療を開始。途中の疑問にも都度お答えします。' },
    ],
  },
  'testimonials-01': {
    heading: '患者様の声',
    mode: 'quote',
    items: [
      {
        quote: '口コミ通り、本当に痛くなかったです。麻酔の説明も丁寧でした。',
        author: 'K.S様',
        role: '30代 会社員・虫歯治療',
      },
      {
        quote: '子供が歯医者を怖がらなくなりました。スタッフの対応に感謝しています。',
        author: 'M.T様',
        role: '40代 主婦・小児歯科',
      },
      {
        quote: '矯正の見た目シミュレーションで安心して決断できました。',
        author: 'Y.H様',
        role: '20代 会社員・マウスピース矯正',
      },
    ],
  },
  'faq-01': {
    heading: 'よくある質問',
    intro: 'ご不明点はお気軽にお問い合わせください。',
    items: [
      {
        question: '保険証がなくても診療できますか？',
        answer: '保険診療は保険証の提示が必要です。自由診療メニューは保険証不要でご案内可能です。',
      },
      {
        question: '痛みに弱いのですが対応してもらえますか？',
        answer: '表面麻酔・電動麻酔器を標準使用しています。事前にお伝えいただければ配慮いたします。',
      },
      {
        question: '当日の予約変更・キャンセルはできますか？',
        answer: 'WEB予約画面から24時間いつでも変更・キャンセルが可能です。',
      },
      { question: '駐車場はありますか？', answer: '医院前に3台分の専用駐車場をご用意しています。' },
    ],
  },
  'cta-01': {
    heading: 'まずは無料相談から、始めませんか。',
    body: '初診カウンセリングは無料です。WEB予約なら待ち時間もございません。',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    phone: '03-5678-1234',
    imageUrl: 'https://picsum.photos/seed/dental-clinic-reception-cta/1600/900',
  },
  'contact-01': {
    heading: 'アクセス・診療時間',
    hours: [
      { day: '月・火・木・金', time: '9:30-13:00 / 15:00-19:30' },
      { day: '土', time: '9:30-13:00 / 14:00-17:00' },
      { day: '水・日・祝', time: '休診' },
    ],
    address: '東京都渋谷区あおば1-2-3 あおばビル2F',
    mapHref: 'https://maps.google.com/?q=渋谷区あおば1-2-3',
    phone: '03-5678-1234',
    ctaLabel: 'WEB予約フォームを開く',
  },
  'footer-01': {
    heading: 'あおば歯科・矯正クリニック',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    phone: '03-5678-1234',
    columns: [
      {
        title: '診療案内',
        links: [
          { label: '一般診療', href: '#services' },
          { label: 'マウスピース矯正', href: '#services' },
          { label: 'ホワイトニング', href: '#services' },
        ],
      },
      {
        title: '医院情報',
        links: [
          { label: '院長紹介', href: '/about' },
          { label: 'アクセス', href: '#contact' },
          { label: 'よくある質問', href: '#faq' },
        ],
      },
    ],
    copyright: '© 2026 あおば歯科・矯正クリニック',
  },
};

const salonContent: SectionContentMap = {
  'header-01': {
    logo: 'salon lumi',
    navItems: [
      { label: 'MENU', href: '#services' },
      { label: 'STYLIST', href: '/about' },
      { label: 'ACCESS', href: '#contact' },
    ],
    ctaLabel: 'WEB予約',
    ctaHref: '#contact',
    phone: '03-4321-9876',
  },
  'hero-01': {
    badge: 'ご予約の65%は営業時間外のWEB予約から',
    title: '仕上がりで選ばれる、最後の一軒。',
    subtitle:
      '切る前に、なりたい自分を言葉にできる。丁寧なカウンセリングと圧倒的な仕上がりで、salon lumiは選ばれています。',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    secondaryLabel: 'MENUを見る',
    secondaryHref: '#services',
    imageUrl: 'https://picsum.photos/seed/salon-lumi-hair-styling-hero/1600/1000',
    anchor: 'top-right',
  },
  'services-01': {
    heading: 'MENU',
    intro: 'カウンセリング + カットは全コース共通。仕上がりまでの時間の目安つき。',
    items: [
      {
        title: 'デザインカット + トリートメント',
        price: '¥9,800',
        description: '骨格に合わせたカウンセリングカット。艶を出すトリートメント付き。約90分。',
        imageUrl: 'https://picsum.photos/seed/salon-haircut-treatment/600/800',
      },
      {
        title: 'イルミナカラー',
        price: '¥13,200',
        description: '色持ちと質感にこだわる外国人風カラー。ダメージレスの薬剤を使用。約150分。',
        imageUrl: 'https://picsum.photos/seed/salon-hair-color-illumina/600/800',
      },
      {
        title: '縮毛矯正 + カット',
        price: '¥19,800',
        description: 'クセを活かしながら自然なストレートに。仕上がりの艶感が続くのが強みです。約210分。',
        imageUrl: 'https://picsum.photos/seed/salon-straight-perm/600/800',
      },
      {
        title: 'ヘッドスパ（単品可）',
        price: '¥5,500',
        description: '眼精疲労にも効く頭皮ケア。単品予約も歓迎、営業時間外のWEB予約が人気です。',
        imageUrl: 'https://picsum.photos/seed/salon-head-spa-treatment/600/800',
      },
    ],
  },
  'features-01': {
    heading: '選ばれる理由',
    intro: '「なんとなく」ではなく、根拠のある仕上がりを。',
    items: [
      { title: '指名率92%のスタイリスト在籍', description: '技術者コンテスト入賞歴を持つスタイリストが在籍しています。' },
      { title: 'カウンセリング専用の個室', description: '周りを気にせずなりたいイメージを伝えられます。' },
      { title: '営業時間外もWEB予約OK', description: '夜23時でも翌朝の枠を確保できます。' },
      { title: '座席は完全予約制', description: '相席・詰め込みをせず、一人ひとりの時間を確保します。' },
    ],
  },
  'about-01': {
    heading: '代表スタイリストより',
    body: '代表 中村 美月（仮名）。都内サロン3店舗での経験を経て2019年にsalon lumiを開業。「切ってからの人生が変わる仕上がり」を信条に、年間800件以上のスタイル提案を行っています。',
    imageUrl: 'https://picsum.photos/seed/salon-stylist-portrait/1200/1400',
    credentials: ['JHDS認定 上級スタイリスト', 'コンテスト入賞歴 5回', '年間指名リピート率 78%'],
  },
  'stats-01': {
    items: [
      { value: '78%', label: '指名リピート率（自社データ）' },
      { value: '65%', label: '営業時間外WEB予約の比率' },
      { value: '800件+', label: '年間スタイル提案数' },
    ],
  },
  'process-01': {
    heading: 'ご来店の流れ',
    steps: [
      { no: '01', title: 'WEB予約', description: '空き状況をリアルタイムで確認し、深夜でも予約完了。' },
      { no: '02', title: 'カウンセリング', description: '画像を見せながら、なりたいイメージをすり合わせます。' },
      { no: '03', title: '施術', description: '担当は最初から最後まで同じスタイリストが担当します。' },
      { no: '04', title: 'アフターケア提案', description: '自宅での再現方法とホームケアをお伝えします。' },
    ],
  },
  'testimonials-01': {
    heading: '仕上がり実例',
    mode: 'beforeAfter',
    // 画像は Unsplash（Unsplash License = 商用可・帰属不要）の実写。デモの被写体可視性を担保。
    // 差替時は実在検証済URL（webfetchで valid JPEG 確認）を使う。
    items: [
      {
        label: 'イルミナカラー',
        beforeImageUrl:
          'https://images.unsplash.com/photo-1619218533116-f050e7d91d91?w=500&h=650&fit=crop&q=80',
        afterImageUrl:
          'https://images.unsplash.com/photo-1554519934-e32b1629d9ee?w=500&h=650&fit=crop&q=80',
        caption: '暗めの地毛から、透明感のあるハイライトへ。ダメージレス施術の一例。',
      },
      {
        label: 'デザインアレンジ',
        beforeImageUrl:
          'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=500&h=650&fit=crop&q=80',
        afterImageUrl:
          'https://images.unsplash.com/photo-1472747624745-ce92d32d3c24?w=500&h=650&fit=crop&q=80',
        caption: 'まとまりにくい髪を、崩れにくい編みおろしアレンジに。',
      },
      {
        label: 'デザインカット',
        beforeImageUrl:
          'https://images.unsplash.com/photo-1546877625-cb8c71916608?w=500&h=650&fit=crop&q=80',
        afterImageUrl:
          'https://images.unsplash.com/photo-1560869713-bf165a9cfac1?w=500&h=650&fit=crop&q=80',
        caption: '重さを軽減し、動きの出るレイヤースタイルへ。',
      },
    ],
  },
  'faq-01': {
    heading: 'よくある質問',
    intro: 'ご予約前にご確認ください。',
    items: [
      {
        question: '深夜でも予約は取れますか？',
        answer: 'WEB予約は24時間受付、営業時間外でも翌営業日以降の枠を確保できます。',
      },
      { question: '指名料はかかりますか？', answer: '指名料は¥1,100（税込）を頂戴しております。' },
      {
        question: 'カラー剤でアレルギーが心配です',
        answer: '事前パッチテストを無料で承っています。ご予約時にお申し付けください。',
      },
      {
        question: '子供を連れて行っても大丈夫ですか？',
        answer: 'キッズスペースはございませんが、短時間のご同伴はご相談ください。',
      },
    ],
  },
  'cta-01': {
    heading: '次の「なりたい」を、今夜のうちに予約する。',
    body: 'ご予約の65%が営業時間外のWEBから。空き状況はリアルタイムで確認できます。',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    phone: '03-4321-9876',
    imageUrl: 'https://picsum.photos/seed/salon-lumi-interior-cta/1600/900',
  },
  'contact-01': {
    heading: 'ACCESS',
    hours: [
      { day: '火-金', time: '11:00-21:00' },
      { day: '土・日', time: '10:00-19:00' },
      { day: '月', time: '定休日' },
    ],
    address: '東京都目黒区自由が丘2-4-5 lumiビル3F',
    mapHref: 'https://maps.google.com/?q=目黒区自由が丘2-4-5',
    phone: '03-4321-9876',
    ctaLabel: 'WEB予約フォームを開く',
  },
  'footer-01': {
    heading: 'salon lumi',
    ctaLabel: 'WEB予約する',
    ctaHref: '#contact',
    phone: '03-4321-9876',
    columns: [
      {
        title: 'MENU',
        links: [
          { label: 'カット', href: '#services' },
          { label: 'カラー', href: '#services' },
          { label: '縮毛矯正', href: '#services' },
        ],
      },
      {
        title: 'SALON',
        links: [
          { label: 'スタイリスト紹介', href: '/about' },
          { label: 'アクセス', href: '#contact' },
          { label: 'よくある質問', href: '#faq' },
        ],
      },
    ],
    copyright: '© 2026 salon lumi',
  },
};

export const sectionContentByTemplate: Record<string, SectionContentMap> = {
  'general-001': clinicContent,
  'general-002': salonContent,
};

/** 後方互換のため general-001（クリニック）のcontentを指すエイリアス。 */
export const sectionContent: SectionContentMap = sectionContentByTemplate['general-001']!;

export default sectionContent;
