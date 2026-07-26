import type { CSSProperties } from 'react';
import { Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * process-01: design.sectionVariants['process-01'] で骨格を決定的に切替える。
 * - timeline        : 縦タイムライン（旧デフォルト。reveal-on-scroll・scroll-driven）
 * - horizontal-steps: 横N列のステップ帯（別次元の構造・スクロール方向を変える）
 * 同じ content を2骨格が読むだけ。自由文判断は挟まない（cta-01 と同じ4層パターン）。
 */

type ProcessStep = { no: string; title: string; description: string };

type ProcessContent = {
  heading: string;
  steps: ProcessStep[];
};

function parseContent(content: Record<string, unknown>): ProcessContent {
  return {
    heading: (content.heading as string) ?? '',
    steps: (content.steps as ProcessStep[]) ?? [],
  };
}

/** 骨格A: 縦タイムライン（reveal-on-scroll・scroll-driven。reduced-motionで全表示） */
function Timeline({ heading, steps }: ProcessContent) {
  return (
    <Container className="flex flex-col gap-10">
      <Heading level={2}>{heading}</Heading>
      <div className="relative flex flex-col gap-10 border-l border-border pl-8 md:pl-12">
        {steps.map((step) => (
          <div key={step.no} className="reveal-on-scroll relative flex flex-col gap-2">
            <span className="absolute -left-[45px] flex h-9 w-9 items-center justify-center rounded-pill bg-primary font-heading text-sm text-primary-contrast md:-left-[61px] md:h-11 md:w-11">
              {step.no}
            </span>
            <Heading level={3}>{step.title}</Heading>
            <Text muted>{step.description}</Text>
          </div>
        ))}
      </div>
    </Container>
  );
}

/**
 * 骨格B: 横N列のステップ帯（動的列数はTailwind静的クラスで表現不可のためCSS変数で渡す）。
 * モバイルは1列縦積み（N列を375px幅へ押し込むと読めなくなるため）、md以上でN列横並びにする。
 */
function HorizontalSteps({ heading, steps }: ProcessContent) {
  return (
    <Container className="flex flex-col gap-10">
      <Heading level={2}>{heading}</Heading>
      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-[repeat(var(--steps-count),minmax(0,1fr))] md:gap-6"
        style={{ '--steps-count': Math.max(steps.length, 1) } as CSSProperties}
      >
        {steps.map((step) => (
          <div
            key={step.no}
            className="reveal-on-scroll flex flex-col gap-2 border-t border-border pt-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-primary font-heading text-sm text-primary-contrast md:h-11 md:w-11">
              {step.no}
            </span>
            <Heading level={3}>{step.title}</Heading>
            <Text muted>{step.description}</Text>
          </div>
        ))}
      </div>
    </Container>
  );
}

export default function Process01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['process-01'] ?? 'timeline';

  return (
    <section data-section-type="process-01" className="py-section">
      {variant === 'horizontal-steps' ? <HorizontalSteps {...c} /> : <Timeline {...c} />}
    </section>
  );
}
