import type { ReactNode } from 'react';
import { PRIMITIVE_BUILD } from './version';

export type TextProps = {
  children: ReactNode;
  muted?: boolean;
  className?: string;
};

export function Text({ children, muted = false, className }: TextProps) {
  const classes = `font-body ${muted ? 'text-text-muted' : 'text-text'} ${className ?? ''}`;

  return (
    <p data-primitive-build={PRIMITIVE_BUILD} data-primitive="text" className={classes}>
      {children}
    </p>
  );
}
