import type { Metadata } from 'next';
import { Fraunces, Shippori_Mincho, Space_Grotesk, Zen_Kaku_Gothic_New, Zen_Old_Mincho } from 'next/font/google';
import './globals.css';

// 可変フォント（真のvariable font・opsz/wght軸）。ラテン文字・数字を担当し、
// clinic/salon 両displayスタックの先頭に置く（JP文字はフォールバックのJP書体が担う）。
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-fraunces',
});

// clinic（minimal-corporate）見出し用の端正な明朝。
const zenOldMincho = Zen_Old_Mincho({
  weight: ['400'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-zen-old-mincho',
});

// clinic/salon 共通の本文JP書体（可読性・清潔感）。
const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-zen-kaku-gothic-new',
});

// salon（warm-studio）見出し用の情緒ある明朝（大ウェイトで特大displayに使う）。
const shipporiMincho = Shippori_Mincho({
  weight: ['500', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-shippori-mincho',
});

// editorial（bold-editorial）見出し用の幾何学サンセリフ（clinic/salonの明朝2系統と対照させる）。
const spaceGrotesk = Space_Grotesk({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'web-platform',
  description: 'ページ構成×デザインシステム×セクション部品の組合せでWebサイトを生成する共通基盤',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${fraunces.variable} ${zenOldMincho.variable} ${zenKakuGothicNew.variable} ${shipporiMincho.variable} ${spaceGrotesk.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
