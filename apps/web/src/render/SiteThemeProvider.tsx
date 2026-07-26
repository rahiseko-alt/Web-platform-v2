import type { CSSProperties, ReactNode } from 'react';

/**
 * data-theme を出力するServer Component。
 * app/globals.css の [data-theme="..."] セレクタがこれを起点に発火する。
 *
 * accentColor（仮説#3・sectionスコープの色編集）が渡された場合、`--site-accent` として
 * 追加注入する。CSS変数はcascadeで子孫要素へ伝播するため、配下のsectionは
 * `bg-[var(--site-accent)]` 等の静的クラス名で参照するだけで反映される
 * （動的クラス名文字列生成はTailwindのpurgeで消えるため使わない）。
 * accentColor未指定時はテーマ既定の --color-accent にフォールバックし、
 * 常に --site-accent が定義された状態を保証する。
 */
export function SiteThemeProvider({
  theme,
  accentColor,
  palette,
  motion,
  motionEffects,
  children,
}: {
  theme: string;
  accentColor?: string;
  /** 配色軸。src/styles/palettes.css の [data-palette] を発火させる。未指定=テーマ既定色 */
  palette?: string;
  /** 動きの強度。プリセット名の記録用（実際に効くのは motionEffects） */
  motion?: string;
  /** 動きの内訳。src/styles/motion.css の [data-motion-effects~='...'] を発火させる */
  motionEffects?: readonly string[];
  children: ReactNode;
}) {
  const style = { '--site-accent': accentColor ?? 'var(--color-accent)' } as CSSProperties;

  return (
    <div
      data-theme={theme}
      data-palette={palette && palette !== 'theme-default' ? palette : undefined}
      data-motion={motion}
      data-motion-effects={motionEffects && motionEffects.length > 0 ? motionEffects.join(' ') : undefined}
      style={style}
    >
      {children}
    </div>
  );
}
