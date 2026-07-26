import type { ReactNode } from 'react';
import type { ButtonShape } from '@/templates/types';
import { PRIMITIVE_BUILD } from './version';

export type ButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  /** 'lg' = sticky CTAバー・hero直下等の強調配置向け。既定'md'は現状サイズを維持 */
  size?: 'md' | 'lg';
  /** 角丸 or ピル（部品変化軸・design.buttonShape から渡す）。既定 'rounded'（現行維持） */
  shape?: ButtonShape;
  /** モバイルsticky CTAバー内などで全幅にする */
  fullWidth?: boolean;
  className?: string;
};

const base = 'font-heading inline-flex items-center justify-center min-h-[var(--tap-target-min)]';
const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-contrast',
  secondary: 'bg-surface text-text border border-border',
};
const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
};
const shapes: Record<ButtonShape, string> = {
  rounded: 'rounded-md',
  pill: 'rounded-full',
};

export function Button({
  href,
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  fullWidth = false,
  className,
}: ButtonProps) {
  const classes = `${base} ${shapes[shape]} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`;

  if (href) {
    return (
      <a
        href={href}
        data-primitive-build={PRIMITIVE_BUILD}
        data-primitive="button"
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      data-primitive-build={PRIMITIVE_BUILD}
      data-primitive="button"
      className={classes}
    >
      {children}
    </button>
  );
}
