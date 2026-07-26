/**
 * 要素値の差し替えUI（微調整の第1種）。
 *
 * 素の GET フォーム。選んで「差し替え」を押すと同じ /try に戻り、
 * **キャッシュ済みの生成結果を機械が組み立て直すだけ**（LLM 再実行なし・課金ゼロ）。
 * 選択肢は台帳（vocabulary.ts）から動的に出すので、台帳が増えれば UI も自動で増える。
 *
 * 2026-07-24 マスター指摘の反映:
 * - 動きは「強さ」1つでなく**内訳をチェックで複数選択**できる（縦並び）
 * - 配色は凡例（PaletteLegend）で「どの色が何に効くか」を見せる
 * - パネル自体は折りたためる（page.tsx の details）。開閉状態は panel=1 で保持する
 */

import type { GeneratedPage } from '@/generate/types';
import { axisLabelJa, labelJa } from '@/generate/labels';
import {
  ALIGNS,
  BUTTON_SHAPES,
  CARD_STYLES,
  HERO_VARIANTS,
  MOTION_EFFECTS,
  PALETTES,
  RHYTHMS,
  SECTION_VARIANTS,
  THEMES,
  variantsFor,
} from '@/generate/vocabulary';
import { PaletteLegend } from './PaletteLegend';

const selectStyle: React.CSSProperties = {
  background: '#1b1b1b',
  color: '#fff',
  border: '1px solid #444',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 11,
  color: '#aaa',
};

/** 表示は日本語・送る値は台帳の機械値のまま（labels.ts が 1:1 で対応を持つ） */
function Field({
  axis,
  name,
  options,
  value,
}: {
  axis: string;
  name: string;
  options: readonly string[];
  value: string;
}) {
  return (
    <label style={labelStyle}>
      {axisLabelJa(axis)}
      <select name={name} defaultValue={value} style={selectStyle}>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelJa(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 動きの内訳。縦に並べ、チェックしたものだけが効く（複数可・全部外すと静止） */
function MotionEffectFields({ selected }: { selected: readonly string[] }) {
  return (
    <fieldset style={{ border: '1px solid #333', borderRadius: 8, padding: '8px 10px', margin: 0, minWidth: 260 }}>
      <legend style={{ fontSize: 11, color: '#aaa', padding: '0 4px' }}>{axisLabelJa('motionEffects')}</legend>
      {/* チェックを全部外した状態と「未指定」を機械が区別するための印 */}
      <input type="hidden" name="fxset" value="1" />
      {MOTION_EFFECTS.map((effect) => (
        <label key={effect} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ddd', padding: '3px 0' }}>
          <input type="checkbox" name="fx" value={effect} defaultChecked={selected.includes(effect)} />
          {labelJa(effect)}
        </label>
      ))}
    </fieldset>
  );
}

/** 使われているセクションのうち、変種を持つものだけ差し替え欄を出す */
function variantFields(page: GeneratedPage) {
  const used = new Set(page.sections.map((s) => s.sectionType));
  return Object.keys(SECTION_VARIANTS)
    .filter((sectionType) => used.has(sectionType))
    .map((sectionType) => ({
      sectionType,
      options: variantsFor(sectionType),
      value: page.design.sectionVariants?.[sectionType] ?? variantsFor(sectionType)[0],
    }));
}

export function DesignControls({
  brief,
  page,
  motionEffects,
  ignored,
}: {
  brief: string;
  page: GeneratedPage;
  motionEffects: readonly string[];
  ignored: string[];
}) {
  return (
    <form
      method="GET"
      action="/try"
      style={{ maxWidth: 1100, margin: '10px auto 0', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}
    >
      <input type="hidden" name="brief" value={brief} />
      {/* 差し替え後もパネルを開いたままにする */}
      <input type="hidden" name="panel" value="1" />

      <Field axis="theme" name="theme" options={THEMES} value={page.theme} />
      <Field axis="palette" name="palette" options={PALETTES} value={page.palette} />
      <Field axis="heroVariant" name="heroVariant" options={HERO_VARIANTS} value={page.design.heroVariant} />
      <Field axis="rhythm" name="rhythm" options={RHYTHMS} value={page.design.rhythm} />
      <Field axis="align" name="align" options={ALIGNS} value={page.design.align} />
      <Field axis="cardStyle" name="cardStyle" options={CARD_STYLES} value={page.design.cardStyle ?? CARD_STYLES[0]} />
      <Field axis="buttonShape" name="buttonShape" options={BUTTON_SHAPES} value={page.design.buttonShape ?? BUTTON_SHAPES[0]} />
      {variantFields(page).map((f) => (
        <Field key={f.sectionType} axis={f.sectionType} name={`sv.${f.sectionType}`} options={f.options} value={f.value} />
      ))}

      {/* 動きは「強さ1択」を廃し、内訳チェックに一本化した（強さ select と併存すると
          強さを変えてもチェック未操作で静止に落ちるバグが出たため・2026-07-24 検証パネル指摘）。
          チェックの初期状態は LLM が選んだ強さ（page.motion）の既定内訳から来る。 */}
      <MotionEffectFields selected={motionEffects} />

      <div style={{ flexBasis: '100%' }}>
        <div style={{ fontSize: 11, color: '#aaa', margin: '4px 0' }}>
          配色の効き方（{labelJa(page.palette)}）— 切り替えると下のLPのどこが変わるか
        </div>
        <PaletteLegend theme={page.theme} palette={page.palette} />
      </div>

      <button
        type="submit"
        style={{ padding: '8px 16px', borderRadius: 6, border: 0, background: '#7db6ff', color: '#111', fontWeight: 700, cursor: 'pointer' }}
      >
        差し替え（LLM不使用）
      </button>
      {ignored.length > 0 && <span style={{ fontSize: 11, color: '#ff9b9b' }}>台帳外のため無視: {ignored.join(' / ')}</span>}
    </form>
  );
}
