import { Card, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * stats-01: design.sectionVariants['stats-01'] で骨格を決定的に切替える。
 * - row : 大数字を display サイズで少数精鋭・単一行（旧デフォルト）
 * - grid: 2カラムグリッド。各項目を Card プリミティブで囲み密度・構造を変える
 * 同じ content を2骨格が読むだけ。自由文判断は挟まない（cta-01 と同じ4層パターン）。
 */

type StatItem = { value: string; label: string };

type StatsContent = {
  items: StatItem[];
};

function parseContent(content: Record<string, unknown>): StatsContent {
  return {
    items: (content.items as StatItem[]) ?? [],
  };
}

/** 骨格A: 単一行に大数字を並べる（旧デフォルト） */
function Row({ items }: StatsContent) {
  return (
    <Container className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
      {items.map((item) => (
        <div key={item.label} className="reveal-on-scroll flex flex-col gap-1">
          <Heading level={2} display>
            {item.value}
          </Heading>
          <Text muted className="max-w-[24ch]">
            {item.label}
          </Text>
        </div>
      ))}
    </Container>
  );
}

/** 骨格B: 2カラムグリッド + Cardで各項目を囲む（密度・構造が異なる別次元） */
function Grid({ items, design }: StatsContent & { design?: DesignSpec }) {
  return (
    <Container className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <Card key={item.label} style={design?.cardStyle} className="reveal-on-scroll flex flex-col gap-1">
          <Heading level={2} display>
            {item.value}
          </Heading>
          <Text muted className="max-w-[24ch]">
            {item.label}
          </Text>
        </Card>
      ))}
    </Container>
  );
}

export default function Stats01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  // items が空なら枠だけの空box を出さず section 自体を描画しない（空box禁止）。
  if (c.items.length === 0) return null;

  const variant = design?.sectionVariants?.['stats-01'] ?? 'row';

  return (
    <section data-section-type="stats-01" className="py-section border-y border-border bg-surface">
      {variant === 'grid' ? <Grid {...c} design={design} /> : <Row {...c} />}
    </section>
  );
}
