/**
 * 要素値の差し替え（微調整の第1種）。
 *
 * LLM が選んだ要素値を、人が台帳の範囲内で入れ替える。**LLM を呼び直さない**
 * ——掛け算の骨格をいじるだけなので機械の再組み立てで済む（課金ゼロ・即時）。
 * これが「LLMは値を選ぶだけ・組み立ては機械」という分担の直接の利点にあたる
 * （docs/ai-agent-dev-method.md §3）。
 *
 * 台帳外の値は**黙って無視せず** ignored に出す（無音フォールバック禁止・validate.ts と同方針）。
 */

import type { GeneratedPage } from './types';
import {
  ALIGNS,
  BUTTON_SHAPES,
  CARD_STYLES,
  EFFECTS_BY_MOTION,
  HERO_VARIANTS,
  MOTIONS,
  MOTION_EFFECTS,
  PALETTES,
  RHYTHMS,
  THEMES,
  variantsFor,
} from './vocabulary';

export interface DesignOverrides {
  theme?: string;
  palette?: string;
  motion?: string;
  /**
   * 動きの内訳を人が明示指定した場合の値（複数選択）。
   * `undefined` = 指定なし（motion の既定内訳を使う）／`[]` = 全部外す、を区別する。
   */
  motionEffects?: string[];
  heroVariant?: string;
  rhythm?: string;
  align?: string;
  /** セクション種別 → 変種。台帳に無い組合せは ignored に出す */
  sectionVariants?: Record<string, string>;
  cardStyle?: string;
  buttonShape?: string;
}

export interface OverrideResult {
  page: GeneratedPage;
  /** 実際に効かせる動きの内訳。CSS の data-motion-effects に出す */
  motionEffects: string[];
  /** 台帳外で採用しなかった指定。UI に出して黙殺を防ぐ */
  ignored: string[];
}

/**
 * 効かせる内訳を決める。明示指定が無ければ motion（強度）の既定内訳へ落とす。
 * 台帳外の指定は黙って捨てず ignored に出す。
 */
export function resolveMotionEffects(motion: string, requested: string[] | undefined, ignored: string[]): string[] {
  if (requested === undefined) {
    const preset = (EFFECTS_BY_MOTION as Record<string, readonly string[]>)[motion] ?? [];
    return [...preset];
  }
  const allowed = MOTION_EFFECTS as readonly string[];
  const kept = requested.filter((effect) => {
    if (allowed.includes(effect)) return true;
    ignored.push(`motionEffects=${effect}`);
    return false;
  });
  return [...new Set(kept)];
}

/** 台帳にある値だけを通す。無い値は ignored に積んで undefined を返す */
function pick<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
  label: string,
  ignored: string[],
): T | undefined {
  if (!value) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  ignored.push(`${label}=${value}`);
  return undefined;
}

/** 生成済みページの要素値を、台帳の範囲内で差し替える */
export function applyOverrides(page: GeneratedPage, overrides: DesignOverrides): OverrideResult {
  const ignored: string[] = [];

  const heroVariant = pick(HERO_VARIANTS, overrides.heroVariant, 'heroVariant', ignored);
  const rhythm = pick(RHYTHMS, overrides.rhythm, 'rhythm', ignored);
  const align = pick(ALIGNS, overrides.align, 'align', ignored);
  const theme = pick(THEMES, overrides.theme, 'theme', ignored);
  const palette = pick(PALETTES, overrides.palette, 'palette', ignored);
  const motion = pick(MOTIONS, overrides.motion, 'motion', ignored);
  const cardStyle = pick(CARD_STYLES, overrides.cardStyle, 'cardStyle', ignored);
  const buttonShape = pick(BUTTON_SHAPES, overrides.buttonShape, 'buttonShape', ignored);

  const sectionVariants: Record<string, string> = { ...page.design.sectionVariants };
  for (const [sectionType, variant] of Object.entries(overrides.sectionVariants ?? {})) {
    if (!variant) continue;
    const allowed = variantsFor(sectionType);
    if (allowed.includes(variant)) {
      sectionVariants[sectionType] = variant;
    } else {
      ignored.push(`${sectionType}=${variant}`);
    }
  }

  const resolvedMotion = motion ?? page.motion;

  return {
    motionEffects: resolveMotionEffects(resolvedMotion, overrides.motionEffects, ignored),
    page: {
      ...page,
      theme: theme ?? page.theme,
      palette: palette ?? page.palette,
      motion: resolvedMotion,
      design: {
        heroVariant: heroVariant ?? page.design.heroVariant,
        rhythm: rhythm ?? page.design.rhythm,
        align: align ?? page.design.align,
        sectionVariants,
        cardStyle: cardStyle ?? page.design.cardStyle,
        buttonShape: buttonShape ?? page.design.buttonShape,
      },
    },
    ignored,
  };
}
