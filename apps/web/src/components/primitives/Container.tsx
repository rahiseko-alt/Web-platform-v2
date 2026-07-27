import type { ReactNode } from 'react';
import { PRIMITIVE_BUILD } from './version';

export type ContainerProps = {
  children: ReactNode;
  className?: string;
  /** true = フルブリード（写真を端まで・docs/design-notes.md §7 --bleed-max）。既定はfalseで現状挙動維持 */
  bleed?: boolean;
};

export function Container({ children, className, bleed = false }: ContainerProps) {
  const classes = bleed ? `w-full ${className ?? ''}` : `max-w-container mx-auto px-6 ${className ?? ''}`;

  return (
    <div data-primitive-build={PRIMITIVE_BUILD} data-primitive="container" className={classes}>
      {children}
    </div>
  );
}
