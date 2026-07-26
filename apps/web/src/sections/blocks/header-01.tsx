import { Button, Container, Heading } from '@/components';
import type { DesignSpec } from '@/templates/types';

/**
 * header-01: design.sectionVariants['header-01'] で骨格を決定的に切替える。
 * - standard     : ロゴ左 + ナビ右（既定・sticky shrink・現行維持）
 * - centered-logo: ロゴ中央 + ナビを左右に分割配置（別次元の構造）
 * どちらも scroll で縮む sticky ヘッダ（globals.css `.header-shrink`・JS不要）+
 * モバイル常時「予約/電話」CTAバー（`.sticky-cta-bar`・md:hidden）は共通。
 * wireframe.md header-01: 「誰か」を1行で示しつつ、予約/電話を常時1タップに保つ。
 */

type NavItem = { label: string; href: string };

type HeaderContent = {
  logo: string;
  navItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
  phone?: string;
};

function parseContent(content: Record<string, unknown>): HeaderContent {
  return {
    logo: content.logo as string,
    navItems: (content.navItems as NavItem[]) ?? [],
    ctaLabel: content.ctaLabel as string,
    ctaHref: content.ctaHref as string,
    // 電話番号は「不明なら省略」が契約。無い時に tel:unknown を出さない
    phone: content.phone as string | undefined,
  };
}

/** 骨格A: ロゴ左 + ナビ右（既定・現行維持） */
function StandardHeaderRow({
  logo,
  navItems,
  ctaLabel,
  ctaHref,
  phone,
  design,
}: HeaderContent & { design?: DesignSpec }) {
  return (
    <Container className="flex items-center justify-between gap-4">
      <Heading level={3} className="shrink-0">
        {logo}
      </Heading>
      <nav className="hidden items-center gap-6 md:flex">
        <ul className="flex items-center gap-6">
          {navItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="font-body text-sm text-text">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        {phone && (
          <Button href={`tel:${phone}`} variant="secondary" shape={design?.buttonShape}>
            電話する
          </Button>
        )}
        <Button href={ctaHref} shape={design?.buttonShape}>
          {ctaLabel}
        </Button>
      </nav>
    </Container>
  );
}

/** 骨格B: ロゴ中央 + ナビを左右に分割配置（左右対称・別次元の構造） */
function CenteredLogoHeaderRow({
  logo,
  navItems,
  ctaLabel,
  ctaHref,
  phone,
  design,
}: HeaderContent & { design?: DesignSpec }) {
  const mid = Math.ceil(navItems.length / 2);
  const leftItems = navItems.slice(0, mid);
  const rightItems = navItems.slice(mid);

  return (
    <Container className="flex items-center justify-between gap-4">
      <nav className="hidden flex-1 items-center justify-end gap-6 md:flex">
        <ul className="flex items-center gap-6">
          {leftItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="font-body text-sm text-text">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Heading level={3} className="shrink-0">
        {logo}
      </Heading>
      <div className="flex flex-1 items-center gap-6">
        <nav className="hidden items-center gap-6 md:flex">
          <ul className="flex items-center gap-6">
            {rightItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="font-body text-sm text-text">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {phone && (
            <Button href={`tel:${phone}`} variant="secondary" shape={design?.buttonShape}>
              電話する
            </Button>
          )}
          <Button href={ctaHref} shape={design?.buttonShape}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </Container>
  );
}

export default function Header01({
  content,
  design,
}: {
  content: Record<string, unknown>;
  design?: DesignSpec;
}) {
  const c = parseContent(content);
  const variant = design?.sectionVariants?.['header-01'] ?? 'standard';

  return (
    <>
      <section
        data-section-type="header-01"
        className="header-shrink sticky top-0 z-50 border-b border-border bg-[var(--color-bg)]/90 backdrop-blur"
      >
        {variant === 'centered-logo' ? (
          <CenteredLogoHeaderRow {...c} design={design} />
        ) : (
          <StandardHeaderRow {...c} design={design} />
        )}
      </section>

      {/* モバイル常時CTAバー（wireframe.md モバイル節・全ページ下部に常設）。両骨格共通 */}
      <div className="sticky-cta-bar flex items-center gap-2 border-t border-border bg-bg p-2 shadow-[0_-2px_12px_rgba(0,0,0,0.12)] md:hidden">
        <div className="flex-1">
          <Button href={c.ctaHref} size="lg" fullWidth shape={design?.buttonShape}>
            {c.ctaLabel}
          </Button>
        </div>
        {c.phone && (
          <div className="flex-1">
            <Button href={`tel:${c.phone}`} variant="secondary" size="lg" fullWidth shape={design?.buttonShape}>
              電話する
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
