import type { CSSProperties } from 'react';
import { resolveSection } from '@/sections/registry';
import type { RenderableSection } from '@/db/queries/site-render';
import type { DesignSpec } from '@/templates/types';

const RHYTHM_VAR: Record<DesignSpec['rhythm'], string> = {
  tight: 'var(--section-py-tight)',
  normal: 'var(--section-py)',
  loose: 'var(--section-py-loose)',
};

/**
 * JSON設定データ（RenderableSection[]）からセクションComponentを組み立てるレンダラ。
 * 未登録sectionTypeはスキップする（本フェーズは12種全登録済のため通常発生しない）。
 *
 * design（DesignSpec）が渡された場合、各Sectionをrhythmトークンでラップする。
 * `--section-py` をこのwrapperで上書きすることで、配下の`py-section`(=var(--section-py))
 * を使う部品が機械的にリズムを継承する（自由文判断を挟まないtoken->CSS変数の決定的写像）。
 * design未指定時は既定の`--section-py`（テーマ値）をそのまま使う（後方互換）。
 */
export function PageRenderer({
  sections,
  design,
}: {
  sections: RenderableSection[];
  design?: DesignSpec;
}) {
  const rhythmStyle = design
    ? ({ '--section-py': RHYTHM_VAR[design.rhythm] } as CSSProperties)
    : undefined;

  return (
    <>
      {sections.map((s) => {
        const Section = resolveSection(s.sectionType);
        if (!Section) return null;
        return (
          <div key={s.id} style={rhythmStyle}>
            <Section content={s.content} design={design} />
          </div>
        );
      })}
    </>
  );
}
