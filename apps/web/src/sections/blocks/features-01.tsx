import { Card, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * features-01: design.sectionVariants['features-01'] で骨格を決定的に切替える。
 * - sticky-scroll: 左スティッキー見出し + 右スクロール項目（2カラム非対称・sticky）
 * - grid         : 上部に見出し全幅 + 下部にカードグリッド（別次元の構造）
 */

type FeatureItem = { title: string; description: string };

type FeaturesContent = {
  heading: string;
  intro?: string;
  items: FeatureItem[];
};

function parseContent(content: Record<string, unknown>): FeaturesContent {
  return {
    heading: content.heading as string,
    intro: content.intro as string | undefined,
    items: (content.items as FeatureItem[]) ?? [],
  };
}

/** 骨格A: 左スティッキー見出し + 右スクロール項目（2カラム非対称・sticky） */
function StickyScrollFeatures({ heading, intro, items }: FeaturesContent) {
  return (
    <Container className="grid gap-8 md:grid-cols-[minmax(220px,340px)_1fr] md:items-start md:gap-16">
      <div className="flex flex-col gap-3 md:sticky md:top-28">
        <Heading level={2}>{heading}</Heading>
        {intro && <Text muted>{intro}</Text>}
      </div>
      <div className="flex flex-col gap-6">
        {items.map((item, index) => (
          <div
            key={item.title}
            className="reveal-on-scroll flex flex-col gap-2 border-b border-border pb-6 last:border-none"
          >
            <Text muted className="font-heading text-sm">{`0${index + 1}`}</Text>
            <Heading level={3}>{item.title}</Heading>
            <Text>{item.description}</Text>
          </div>
        ))}
      </div>
    </Container>
  );
}

/** 骨格B: 上部に見出し全幅 + 下部にカードグリッド（別次元の構造） */
function GridFeatures({ heading, intro, items, design }: FeaturesContent & { design?: DesignSpec }) {
  return (
    <Container className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Heading level={2}>{heading}</Heading>
        {intro && <Text muted className="max-w-[var(--measure)]">{intro}</Text>}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} style={design?.cardStyle} className="reveal-on-scroll flex flex-col gap-2">
            <Heading level={3}>{item.title}</Heading>
            <Text>{item.description}</Text>
          </Card>
        ))}
      </div>
    </Container>
  );
}

export default function Features01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  // items が空なら描画すべきコンテンツが無いため section 自体を描画しない（空box禁止）。
  if (c.items.length === 0) return null;

  const variant = design?.sectionVariants?.['features-01'] ?? 'sticky-scroll';

  return (
    <section data-section-type="features-01" className="py-section">
      {variant === 'grid' ? <GridFeatures {...c} design={design} /> : <StickyScrollFeatures {...c} />}
    </section>
  );
}
