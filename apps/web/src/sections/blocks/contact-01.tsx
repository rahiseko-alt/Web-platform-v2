import { Button, Card, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * contact-01: design.sectionVariants['contact-01'] で骨格を決定的に切替える。
 * - centered   : 中央寄せの単一ブロック（既定）
 * - split-panel: 左=見出し／右=Cardの連絡先パネル（2カラム・別次元構造）
 */

type ContactContent = {
  heading: string;
  email?: string;
  phone?: string;
  ctaLabel: string;
};

function parseContent(content: Record<string, unknown>): ContactContent {
  return {
    heading: content.heading as string,
    // 連絡先は「不明なら省略」が契約（generate/section-schemas.ts）。
    // 未指定のまま描画すると空行や "unknown" が本文に出るため、有る時だけ出す。
    email: content.email as string | undefined,
    phone: content.phone as string | undefined,
    ctaLabel: content.ctaLabel as string,
  };
}

/** 骨格A: 中央寄せの単一ブロック */
function CenteredContact({ heading, email, phone, ctaLabel, design }: ContactContent & { design?: DesignSpec }) {
  return (
    <Container className="flex flex-col gap-4">
      <Heading level={2}>{heading}</Heading>
      {email && <Text>{email}</Text>}
      {phone && <Text>{phone}</Text>}
      <Button shape={design?.buttonShape}>{ctaLabel}</Button>
    </Container>
  );
}

/** 骨格B: 左=見出し・右=Cardの連絡先パネル（2カラム・別次元構造） */
function SplitPanelContact({ heading, email, phone, ctaLabel, design }: ContactContent & { design?: DesignSpec }) {
  return (
    <Container>
      <div className="grid items-start gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-3 text-left">
          <Heading level={2}>{heading}</Heading>
        </div>
        <Card style={design?.cardStyle} className="flex flex-col items-start gap-4">
          {email && <Text>{email}</Text>}
          {phone && <Text>{phone}</Text>}
          <Button shape={design?.buttonShape}>{ctaLabel}</Button>
        </Card>
      </div>
    </Container>
  );
}

export default function Contact01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['contact-01'] ?? 'centered';

  return (
    <section data-section-type="contact-01" className="py-section">
      {variant === 'split-panel' ? (
        <SplitPanelContact {...c} design={design} />
      ) : (
        <CenteredContact {...c} design={design} />
      )}
    </section>
  );
}
