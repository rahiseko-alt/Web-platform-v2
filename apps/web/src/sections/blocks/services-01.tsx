import { Card, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * services-01: design.sectionVariants['services-01'] で骨格を決定的に切替える。
 * - horizontal-rail : 横スクロール比較レール（scroll-snap・操作次元の再発明）
 * - editorial-index : 縦の非対称エディトリアル索引（大見出し番号＋左右交互の画像オフセット）
 * 同じ content を2骨格が読むだけ。自由文判断は挟まない（hero-01 と同じ4層パターン）。
 */

type ServiceItem = { title: string; price: string; description: string; imageUrl: string };

type ServicesContent = {
  heading: string;
  intro?: string;
  items: ServiceItem[];
};

function parseContent(content: Record<string, unknown>): ServicesContent {
  return {
    heading: (content.heading as string) ?? '',
    intro: content.intro as string | undefined,
    items: (content.items as ServiceItem[]) ?? [],
  };
}

/** 骨格A: 横スクロール比較レール（scroll-snap） */
function HorizontalRail({
  heading,
  intro,
  items,
  design,
}: ServicesContent & { design?: DesignSpec }) {
  return (
    <>
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <Heading level={2} className="max-w-[40ch]">
            {heading}
          </Heading>
          {intro && (
            <Text muted className="max-w-[46ch]">
              {intro}
            </Text>
          )}
        </div>
      </Container>

      <div className="flex snap-x snap-mandatory gap-[var(--rail-gap)] overflow-x-auto scroll-smooth px-6 pb-2 md:px-[max(1.5rem,calc((100vw-var(--container-max))/2))]">
        {items.map((item) => (
          <Card
            key={item.title}
            style={design?.cardStyle}
            className="w-[var(--snap-card-w)] shrink-0 snap-start overflow-hidden !p-0"
          >
            <img src={item.imageUrl} alt="" className="img-duotone h-48 w-full object-cover" />
            <div className="flex flex-col gap-2 p-5">
              <Heading level={3}>{item.title}</Heading>
              <Text className="font-heading text-sm text-primary">{item.price}</Text>
              <Text muted>{item.description}</Text>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/** 骨格B: 縦の非対称エディトリアル索引（大番号＋左右交互の画像・別の次元構造） */
function EditorialIndex({ heading, intro, items }: ServicesContent) {
  return (
    <Container className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <Heading level={2} className="max-w-[40ch]">
          {heading}
        </Heading>
        {intro && (
          <Text muted className="max-w-[46ch]">
            {intro}
          </Text>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border">
        {items.map((item, i) => (
          <div
            key={item.title}
            className="reveal-on-scroll grid gap-6 py-8 md:grid-cols-12 md:items-center md:gap-10"
          >
            <div
              className={`flex items-baseline gap-4 md:col-span-5 ${
                i % 2 === 1 ? 'md:order-2 md:col-start-8' : 'md:col-start-1'
              }`}
            >
              <span className="font-heading text-4xl leading-none text-primary/40 md:text-6xl">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-1.5">
                <Heading level={3}>{item.title}</Heading>
                <Text className="font-heading text-sm text-primary">{item.price}</Text>
                <Text muted className="text-sm">
                  {item.description}
                </Text>
              </div>
            </div>
            <div
              className={`md:col-span-6 ${
                i % 2 === 1 ? 'md:order-1 md:col-start-1' : 'md:col-start-7'
              }`}
            >
              <img
                src={item.imageUrl}
                alt=""
                className="img-duotone aspect-[16/10] w-full rounded-lg object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}

export default function Services01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  if (c.items.length === 0) return null;

  const variant = design?.sectionVariants?.['services-01'] ?? 'horizontal-rail';

  return (
    <section data-section-type="services-01" className="py-section">
      {variant === 'editorial-index' ? (
        <EditorialIndex {...c} />
      ) : (
        <HorizontalRail {...c} design={design} />
      )}
    </section>
  );
}
