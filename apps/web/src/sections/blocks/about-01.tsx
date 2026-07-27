import { Card, Container, Heading, Text } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * about-01: design.sectionVariants['about-01'] で骨格を決定的に切替える。
 * - photo-band    : フルブリード人物写真の帯 + テキストを版面に食い込ませる（重なり・既定）
 * - split-portrait: 2カラム（左=ポートレート画像・contained／右=テキスト）の別次元構造
 */

type AboutContent = {
  heading: string;
  body: string;
  imageUrl: string;
  credentials: string[];
};

function parseContent(content: Record<string, unknown>): AboutContent {
  return {
    heading: content.heading as string,
    body: content.body as string,
    imageUrl: content.imageUrl as string,
    credentials: (content.credentials as string[]) ?? [],
  };
}

/**
 * 骨格A: フルブリード人物写真の帯 + テキストを版面に食い込ませる（重なり）。院長/オーナーの顔＝信頼シグナル（docs/design-notes.md §7）。
 * 重なりカードは独自の浮遊感（半透明・強シャドウ）が意匠上の要のため、Card プリミティブ化はしない
 * （既定variantの見た目は変更しない要件・cardStyle軸はsplit-portrait側で担う）。
 */
function PhotoBandAbout({ heading, body, imageUrl, credentials }: AboutContent) {
  return (
    <>
      <Container bleed>
        <div className="relative h-[56vh] min-h-[360px] w-full overflow-hidden">
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[var(--color-primary)]/15 mix-blend-multiply" />
        </div>
      </Container>
      <Container>
        <div className="relative z-10 -mt-20 max-w-xl rounded-lg border border-border bg-bg/95 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur md:-mt-28 md:ml-4 md:p-10">
          <Heading level={2}>{heading}</Heading>
          <Text className="mt-4">{body}</Text>
          {credentials.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
              {credentials.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" />
                  <Text muted className="text-sm">
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}

/** 骨格B: 2カラム・左にcontainedなポートレート画像、右にテキストとcredentials（フルブリードとは別次元の構造） */
function SplitPortraitAbout({ heading, body, imageUrl, credentials, design }: AboutContent & { design?: DesignSpec }) {
  return (
    <Container>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <img
          src={imageUrl}
          alt=""
          className="aspect-[3/4] w-full rounded-lg object-cover"
        />
        <Card style={design?.cardStyle}>
          <Heading level={2}>{heading}</Heading>
          <Text className="mt-4">{body}</Text>
          {credentials.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
              {credentials.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" />
                  <Text muted className="text-sm">
                    {c}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Container>
  );
}

export default function About01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['about-01'] ?? 'photo-band';

  return (
    <section data-section-type="about-01" className="relative pb-section">
      {variant === 'split-portrait' ? (
        <SplitPortraitAbout {...c} design={design} />
      ) : (
        <PhotoBandAbout {...c} />
      )}
    </section>
  );
}
