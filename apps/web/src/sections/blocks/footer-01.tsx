import { Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * footer-01: design.sectionVariants['footer-01'] で骨格を決定的に切替える。
 * - columns         : 複数リンクカラムが横並び（既定・現行維持）
 * - centered-stacked: 全体中央寄せ・単一カラムに集約（別次元の構造）
 */

type FooterColumn = { title: string; links: Array<{ label: string; href: string }> };

type FooterContent = {
  columns: FooterColumn[];
  copyright: string;
};

function parseContent(content: Record<string, unknown>): FooterContent {
  return {
    columns: (content.columns as FooterColumn[]) ?? [],
    copyright: content.copyright as string,
  };
}

/** 骨格A: 複数リンクカラムが横並び（既定・現行維持） */
function ColumnsFooter({ columns, copyright }: FooterContent) {
  return (
    <Container className="flex flex-col gap-8 py-section">
      <div className="grid gap-6 md:grid-cols-4">
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-2">
            <Heading level={3}>{column.title}</Heading>
            <ul className="flex flex-col gap-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="font-body text-text-muted">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Text muted>{copyright}</Text>
    </Container>
  );
}

/** 骨格B: 全体中央寄せ・リンクを単一カラムへ集約（多カラム横並びを捨てる別次元構造） */
function CenteredStackedFooter({ columns, copyright }: FooterContent) {
  return (
    <Container className="flex flex-col items-center gap-8 py-section text-center">
      <div className="flex flex-col items-center gap-6">
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col items-center gap-2">
            <Heading level={3}>{column.title}</Heading>
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="font-body text-text-muted">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Text muted>{copyright}</Text>
    </Container>
  );
}

export default function Footer01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['footer-01'] ?? 'columns';

  return (
    <section data-section-type="footer-01">
      <footer>
        {variant === 'centered-stacked' ? <CenteredStackedFooter {...c} /> : <ColumnsFooter {...c} />}
      </footer>
    </section>
  );
}
