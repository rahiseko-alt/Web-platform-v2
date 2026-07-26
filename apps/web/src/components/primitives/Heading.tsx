import type { ReactNode } from 'react';
import { PRIMITIVE_BUILD } from './version';

export type HeadingProps = {
  level?: 1 | 2 | 3;
  /** true = エディトリアルな display サイズ（--text-display・可変フォントのopsz/wght軸を効かせる） */
  display?: boolean;
  children: ReactNode;
  className?: string;
};

const sizes: Record<NonNullable<HeadingProps['level']>, string> = {
  1: 'text-4xl md:text-5xl',
  2: 'text-3xl',
  3: 'text-xl',
};

const displaySize =
  'text-[length:var(--text-display)] leading-[1.05] tracking-[var(--tracking-tight)] [font-variation-settings:var(--font-variation-display)]';

export function Heading({ level = 2, display = false, children, className }: HeadingProps) {
  const classes = `font-heading text-text ${display ? displaySize : sizes[level]} ${className ?? ''}`;
  const sharedProps = {
    'data-primitive-build': PRIMITIVE_BUILD,
    'data-primitive': 'heading',
    className: classes,
  } as const;

  if (level === 1) {
    return <h1 {...sharedProps}>{children}</h1>;
  }
  if (level === 3) {
    return <h3 {...sharedProps}>{children}</h3>;
  }
  return <h2 {...sharedProps}>{children}</h2>;
}
