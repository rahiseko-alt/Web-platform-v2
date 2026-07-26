import { Button, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * cta-01: design.sectionVariants['cta-01'] で骨格を決定的に切替える。
 * - centered   : 中央寄せの帯（accentカラー編集デモ・仮説#3）
 * - split-media: 画像＋テキストの非対称スプリットバナー（別次元の構造）
 * どちらも SiteThemeProvider 注入の --site-accent を静的クラスで参照し accent 編集デモを維持する。
 */

type CtaContent = {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
  phone?: string;
};

function parseContent(content: Record<string, unknown>): CtaContent {
  return {
    heading: (content.heading as string) ?? '',
    body: (content.body as string) ?? '',
    ctaLabel: (content.ctaLabel as string) ?? '',
    ctaHref: (content.ctaHref as string) ?? '#',
    imageUrl: content.imageUrl as string | undefined,
    phone: content.phone as string | undefined,
  };
}

/** 骨格A: 中央寄せ帯（accentカラー編集デモ） */
function CenteredCta({
  heading,
  body,
  ctaLabel,
  ctaHref,
  phone,
  design,
}: CtaContent & { design?: DesignSpec }) {
  return (
    <Container className="flex flex-col items-center gap-4 text-center">
      <Heading level={2}>{heading}</Heading>
      <Text>{body}</Text>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button href={ctaHref} shape={design?.buttonShape}>
          {ctaLabel}
        </Button>
        {phone && (
          <Text muted className="font-heading text-sm">
            {phone}
          </Text>
        )}
      </div>
    </Container>
  );
}

/** 骨格B: 非対称スプリットバナー（画像＋テキスト・別次元構造） */
function SplitMediaCta({
  heading,
  body,
  ctaLabel,
  ctaHref,
  imageUrl,
  phone,
  design,
}: CtaContent & { design?: DesignSpec }) {
  return (
    <Container>
      <div className="grid items-stretch gap-8 md:grid-cols-12 md:gap-0">
        <div className="reveal-on-scroll flex flex-col justify-center gap-5 md:col-span-7 md:py-4 md:pr-12">
          <Heading level={2}>{heading}</Heading>
          <Text className="max-w-[var(--measure)]">{body}</Text>
          <div className="flex flex-wrap items-center gap-4">
            <Button href={ctaHref} size="lg" shape={design?.buttonShape}>
              {ctaLabel}
            </Button>
            {phone && (
              <Text muted className="font-heading text-sm">
                {phone}
              </Text>
            )}
          </div>
        </div>
        {imageUrl && (
          <div className="md:col-span-5">
            <img
              src={imageUrl}
              alt=""
              className="img-duotone aspect-[4/3] w-full rounded-lg object-cover md:h-full"
            />
          </div>
        )}
      </div>
    </Container>
  );
}

export default function Cta01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['cta-01'] ?? 'centered';

  return (
    // アクセントカラー編集（仮説#3）を可視反映するデモ: --site-accent を静的クラスで参照。
    <section
      data-section-type="cta-01"
      className="py-section bg-[var(--site-accent)]/10 border-y border-[var(--site-accent)]/30"
    >
      {variant === 'split-media' ? (
        <SplitMediaCta {...c} design={design} />
      ) : (
        <CenteredCta {...c} design={design} />
      )}
    </section>
  );
}
