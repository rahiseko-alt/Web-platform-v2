import { Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * faq-01: design.sectionVariants['faq-01'] で骨格を決定的に切替える。
 * - stacked    : 単一カラムでQ/Aを縦積み（既定）
 * - two-column : items を偶数/奇数index で2カラムに分けて並べる（別次元の構造）
 */

type FaqItem = { question: string; answer: string };

type FaqContent = {
  heading: string;
  items: FaqItem[];
};

function parseContent(content: Record<string, unknown>): FaqContent {
  return {
    heading: content.heading as string,
    items: (content.items as FaqItem[]) ?? [],
  };
}

function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.question} className="flex flex-col gap-1">
          <Heading level={3}>{item.question}</Heading>
          <Text>{item.answer}</Text>
        </div>
      ))}
    </div>
  );
}

/** 骨格A: 単一カラムでQ/Aを縦積み */
function StackedFaq({ items }: { items: FaqItem[] }) {
  return <FaqList items={items} />;
}

/** 骨格B: items を偶数/奇数indexで2カラムに分け、左右それぞれ縦積み（別次元の構造） */
function TwoColumnFaq({ items }: { items: FaqItem[] }) {
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);

  return (
    <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
      <FaqList items={left} />
      <FaqList items={right} />
    </div>
  );
}

export default function Faq01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['faq-01'] ?? 'stacked';

  return (
    <section data-section-type="faq-01" className="py-section">
      <Container className="flex flex-col gap-6">
        <Heading level={2}>{c.heading}</Heading>
        {variant === 'two-column' ? <TwoColumnFaq items={c.items} /> : <StackedFaq items={c.items} />}
      </Container>
    </section>
  );
}
