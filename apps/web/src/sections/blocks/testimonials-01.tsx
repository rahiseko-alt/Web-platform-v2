import { Card, Container, Heading, Text } from '@/components';

/**
 * testimonials-01: content.mode（'quote' | 'beforeAfter'）で骨格そのものを切り替える。
 * quote は証言カード2カラム、beforeAfter は施術前後の比較ギャラリー（別構造）。
 * hero-01 と同じ4層パターン（parse / 骨格別関数 / mode 分岐 / data-section-type ラッパ）。
 * mode は「証言」か「実例（写真で見せる）」かという業種コンテンツの性質差＝content 側で決まる。
 */

type QuoteItem = { quote: string; author: string; role: string };
type BeforeAfterItem = {
  label: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  caption: string;
};

/** 骨格A: 証言カード2カラム（テキスト主役） */
function QuoteCards({ heading, items }: { heading: string; items: QuoteItem[] }) {
  return (
    <Container className="flex flex-col gap-8">
      <Heading level={2}>{heading}</Heading>
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.author} className="reveal-on-scroll flex flex-col gap-3">
            <Text className="text-lg leading-relaxed">「{item.quote}」</Text>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
              <Heading level={3}>{item.author}</Heading>
              <Text muted className="text-sm">
                {item.role}
              </Text>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}

/** 骨格B: 施術前後の比較ギャラリー（before|after を並置し、写真で変化を見せる別構造） */
function BeforeAfterGallery({ heading, items }: { heading: string; items: BeforeAfterItem[] }) {
  return (
    <Container className="flex flex-col gap-8">
      <Heading level={2}>{heading}</Heading>
      <div className="grid gap-8 md:grid-cols-3">
        {items.map((item) => (
          <figure key={item.label} className="reveal-on-scroll flex flex-col gap-3">
            <div className="relative grid grid-cols-2 overflow-hidden rounded-lg border border-border">
              <div className="relative">
                <img
                  src={item.beforeImageUrl}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                />
                <span className="absolute left-2 top-2 rounded-pill bg-[var(--color-text)]/70 px-2.5 py-0.5 text-[10px] font-body uppercase tracking-wider text-[var(--color-bg)]">
                  Before
                </span>
              </div>
              <div className="relative border-l border-border">
                <img
                  src={item.afterImageUrl}
                  alt=""
                  className="aspect-[4/5] w-full object-cover"
                />
                <span className="absolute right-2 top-2 rounded-pill bg-primary px-2.5 py-0.5 text-[10px] font-body uppercase tracking-wider text-primary-contrast">
                  After
                </span>
              </div>
            </div>
            <figcaption className="flex flex-col gap-1">
              <Heading level={3}>{item.label}</Heading>
              <Text muted className="text-sm">
                {item.caption}
              </Text>
            </figcaption>
          </figure>
        ))}
      </div>
    </Container>
  );
}

export default function Testimonials01({ content }: { content: Record<string, unknown> }) {
  const heading = (content.heading as string) ?? '';
  const mode = (content.mode as string) === 'beforeAfter' ? 'beforeAfter' : 'quote';

  if (mode === 'beforeAfter') {
    const items = (content.items as BeforeAfterItem[]) ?? [];
    // items が空なら無音の空box を出さず section 自体を描画しない（空box禁止）。
    if (items.length === 0) return null;
    return (
      <section data-section-type="testimonials-01" className="py-section">
        <BeforeAfterGallery heading={heading} items={items} />
      </section>
    );
  }

  const items = (content.items as QuoteItem[]) ?? [];
  if (items.length === 0) return null;
  return (
    <section data-section-type="testimonials-01" className="py-section">
      <QuoteCards heading={heading} items={items} />
    </section>
  );
}
