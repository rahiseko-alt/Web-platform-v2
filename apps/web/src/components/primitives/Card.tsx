import type { ReactNode } from 'react';
import type { CardStyle } from '@/templates/types';
import { PRIMITIVE_BUILD } from './version';

export type CardProps = {
  children: ReactNode;
  /** 角丸・余白・色調のプリセット（部品変化軸・design.cardStyle から渡す）。既定 'flat' */
  style?: CardStyle;
  className?: string;
};

const styles: Record<CardStyle, string> = {
  flat: 'bg-surface border border-border rounded-lg p-6',
  soft: 'bg-surface border border-border rounded-2xl p-8',
  bold: 'bg-primary/5 border border-primary/30 rounded-lg p-6',
};

export function Card({ children, style = 'flat', className }: CardProps) {
  const classes = `${styles[style]} ${className ?? ''}`;

  return (
    <div data-primitive-build={PRIMITIVE_BUILD} data-primitive="card" data-card-style={style} className={classes}>
      {children}
    </div>
  );
}
