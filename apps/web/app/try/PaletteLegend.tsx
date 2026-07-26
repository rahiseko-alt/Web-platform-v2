/**
 * 配色の凡例（2026-07-24 マスター指摘「どのテキストの色がどう変わるのか分からない」）。
 *
 * palettes.css が差し替えているのは CSS 変数であって「見出しの色」ではないため、
 * 配色を切り替えても**どのトークンが何に効いているか**が画面から読み取れなかった。
 * ここで トークン → 実際の色 → 何に使われるか を並べて可視化する。
 *
 * 色は自前で持たず、選択中の theme/palette を付けた入れ物の中で var() を解決させる
 * ＝**palettes.css が唯一の正本**のまま（色値をここに書き写さない）。
 */

const TOKENS: ReadonlyArray<{ variable: string; label: string; usage: string; kind: 'fill' | 'text' }> = [
  { variable: '--color-bg', label: '背景', usage: 'ページ全体の下地', kind: 'fill' },
  { variable: '--color-surface', label: '面', usage: 'カード・帯の下地', kind: 'fill' },
  { variable: '--color-text', label: '本文・見出しの文字', usage: '見出し / 本文', kind: 'text' },
  { variable: '--color-text-muted', label: '補足の文字', usage: '説明文 / キャプション / 価格の但し書き', kind: 'text' },
  { variable: '--color-primary', label: '主役色', usage: 'ボタンの地 / 強調', kind: 'fill' },
  { variable: '--color-primary-contrast', label: '主役の上の文字', usage: 'ボタン内の文字', kind: 'text' },
  { variable: '--color-accent', label: 'アクセント', usage: '番号 / 小見出し / 強調線', kind: 'text' },
  { variable: '--color-border', label: '罫線', usage: '区切り線 / 枠', kind: 'fill' },
];

export function PaletteLegend({ theme, palette }: { theme: string; palette: string }) {
  return (
    <div
      data-theme={theme}
      data-palette={palette !== 'theme-default' ? palette : undefined}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: 10,
        borderRadius: 8,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
      }}
    >
      {TOKENS.map((token) => (
        <div key={token.variable} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 150 }}>
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              background: token.kind === 'fill' ? `var(${token.variable})` : 'var(--color-surface)',
              color: token.kind === 'text' ? `var(${token.variable})` : 'transparent',
              border: '1px solid var(--color-border)',
            }}
          >
            A
          </span>
          <span style={{ lineHeight: 1.3 }}>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text)' }}>{token.label}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)' }}>{token.usage}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
