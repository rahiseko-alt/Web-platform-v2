import type { CSSProperties, ReactNode } from 'react';
import { Button, Container, Heading, Text } from '@/components';
import type { DesignSpec, HeroVariant } from '@/templates/types';

/**
 * hero-01: token(design.heroVariant) -> 3つの離散骨格への決定的写像（金太郎飴脱却の実証部品）。
 * 自由文で「良さそう」を判断/生成する経路は無い。同じcontentキーを3骨格それぞれが読むだけで、
 * design（構造化トークン）が変われば構造そのものが別物になる。
 */
const anchorClasses: Record<'bottom-left' | 'top-right', string> = {
  'bottom-left': 'items-start justify-end pb-14 pt-24 text-left md:pb-20 md:pr-24',
  'top-right': 'items-end justify-start pb-24 pt-14 text-right md:pl-24 md:pt-20',
};

type HeroContent = {
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  imageUrl: string;
  anchor: 'bottom-left' | 'top-right';
};

function parseContent(content: Record<string, unknown>): HeroContent {
  return {
    badge: content.badge as string,
    title: content.title as string,
    subtitle: content.subtitle as string,
    ctaLabel: content.ctaLabel as string,
    ctaHref: content.ctaHref as string,
    secondaryLabel: content.secondaryLabel as string,
    secondaryHref: content.secondaryHref as string,
    imageUrl: content.imageUrl as string,
    anchor: ((content.anchor as string) === 'top-right' ? 'top-right' : 'bottom-left') as
      | 'bottom-left'
      | 'top-right',
  };
}

/** 骨格A: 非対称2カラム・大displayの見出しを左、画像を右にオフセット/重ねる（品位寄り） */
function SplitEditorial({ content }: { content: HeroContent }) {
  return (
    <Container>
      <div className="grid gap-10 py-20 md:grid-cols-12 md:items-center md:py-28">
        <div className="reveal-on-scroll flex flex-col gap-5 md:col-span-7 md:col-start-1">
          <span className="inline-flex w-fit items-center rounded-pill border border-border bg-surface px-4 py-1.5 text-xs font-body text-text-muted">
            {content.badge}
          </span>
          <Heading level={1} display>
            {content.title}
          </Heading>
          <Text muted className="max-w-[var(--measure)]">
            {content.subtitle}
          </Text>
          <div className="flex flex-wrap gap-3">
            <Button href={content.ctaHref} size="lg">
              {content.ctaLabel}
            </Button>
            <Button href={content.secondaryHref} variant="secondary" size="lg">
              {content.secondaryLabel}
            </Button>
          </div>
        </div>
        <div className="relative md:col-span-6 md:col-start-7 md:-ml-16">
          <img
            src={content.imageUrl}
            alt=""
            className="hero-photo-zoom aspect-[4/5] w-full rounded-lg object-cover shadow-2xl md:translate-y-10"
          />
        </div>
      </div>
    </Container>
  );
}

/** 骨格B: フルブリード写真（Container bleed）+ 非対称テキストoverlay + デュオトーン（緊張寄り） */
function FullbleedAsymmetric({ content }: { content: HeroContent }) {
  return (
    <Container bleed>
      <div className="relative h-[88vh] min-h-[560px] w-full overflow-hidden">
        <img
          src={content.imageUrl}
          alt=""
          className="hero-photo-zoom absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-text)]/85 via-[var(--color-text)]/25 to-transparent" />
        <div className="absolute inset-0 bg-[var(--color-primary)]/25 mix-blend-multiply" />

        {/*
          Heading/Text は `text-text`（= var(--color-text)）で色を決めるため、Tailwindの
          競合クラス上書き（tailwind-mergeを導入していない）に頼らず、このスコープの
          --color-text をCSS変数で直接上書きして写真上でも読める明色にする
          （SiteThemeProviderの--site-accentと同じCSS変数カスケード手法）。
        */}
        <div
          className={`reveal-on-scroll relative z-10 flex h-full flex-col gap-5 px-6 md:w-2/3 md:px-16 ${anchorClasses[content.anchor]}`}
        >
          <div className="flex flex-col gap-5" style={{ '--color-text': 'var(--color-bg)' } as CSSProperties}>
            <span className="inline-flex w-fit items-center rounded-pill border border-[var(--color-bg)]/40 bg-[var(--color-bg)]/10 px-4 py-1.5 text-xs font-body text-text backdrop-blur">
              {content.badge}
            </span>
            <Heading level={1} display>
              {content.title}
            </Heading>
            <Text className="max-w-[var(--measure)] opacity-90">{content.subtitle}</Text>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href={content.ctaHref} size="lg">
              {content.ctaLabel}
            </Button>
            <Button href={content.secondaryHref} variant="secondary" size="lg">
              {content.secondaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}

/** 骨格C: 特大タイポ主役（可変フォントdisplay）・画像最小・強コントラスト帯（動勢寄り） */
function TypographicKinetic({ content }: { content: HeroContent }) {
  return (
    <div className="border-b border-border bg-[var(--color-text)] py-20 md:py-32">
      <Container>
        <div
          className="reveal-on-scroll flex flex-col gap-8"
          style={{ '--color-text': 'var(--color-bg)' } as CSSProperties}
        >
          <span className="inline-flex w-fit items-center rounded-pill border border-[var(--color-bg)]/40 px-4 py-1.5 text-xs font-body text-text">
            {content.badge}
          </span>
          <Heading level={1} display className="max-w-5xl">
            {content.title}
          </Heading>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Text className="max-w-[var(--measure)] text-text opacity-80">{content.subtitle}</Text>
            <img
              src={content.imageUrl}
              alt=""
              className="hero-photo-zoom h-24 w-24 shrink-0 rounded-md object-cover md:h-32 md:w-32"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href={content.ctaHref} size="lg">
              {content.ctaLabel}
            </Button>
            <Button href={content.secondaryHref} variant="secondary" size="lg">
              {content.secondaryLabel}
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function Hero01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  // design未指定時は split-editorial 相当へフォールバック（既存挙動の後方互換）。
  const heroVariant: HeroVariant = design?.heroVariant ?? 'split-editorial';

  let body: ReactNode;
  switch (heroVariant) {
    case 'fullbleed-asymmetric':
      body = <FullbleedAsymmetric content={c} />;
      break;
    case 'typographic-kinetic':
      body = <TypographicKinetic content={c} />;
      break;
    case 'split-editorial':
    default:
      body = <SplitEditorial content={c} />;
      break;
  }

  return (
    <section data-section-type="hero-01" className="relative">
      {body}
    </section>
  );
}
