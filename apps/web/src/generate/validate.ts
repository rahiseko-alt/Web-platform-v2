/**
 * 機械制御ゲート（plan A4）。B 図の「機械制御で確認 → 許可 / 拒否」の実体。
 *
 * 原則:
 * - 台帳（vocabulary.ts / section-schemas.ts）に照らして enum外・必須軸欠落・
 *   セクション種別不明・変種不正・項目数超過を**拒否**する
 * - 拒否時は「何が範囲外だったか」を添えて差し戻す。**既定値で黙って埋めない**
 *   （無音のフォールバックは失敗を隠し、評価が回らなくなるため）
 * - 握りつぶさない。想定外の形は必ず rejection として表に出す
 */

import { z } from 'zod';
import type { DesignSpec } from '@/templates/types';
import { schemaFor } from './section-schemas';
import { llmOutputSchema, type GeneratedPage, type LlmOutput, type Rejection, type ValidationResult } from './types';
import { isSectionType, variantsFor } from './vocabulary';

function issuesToRejections(error: z.ZodError, prefix: string): Rejection[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    reason: issue.message,
  }));
}

/** design.sectionVariants が台帳の範囲内か。変種を持たないセクションへの指定も拒否する */
function checkSectionVariants(output: LlmOutput): Rejection[] {
  const rejections: Rejection[] = [];
  for (const [sectionType, variant] of Object.entries(output.design.sectionVariants ?? {})) {
    const allowed = variantsFor(sectionType);
    if (allowed.length === 0) {
      rejections.push({
        path: `design.sectionVariants.${sectionType}`,
        reason: `${sectionType} は変種を持たないセクションです。指定を外してください`,
      });
      continue;
    }
    if (!allowed.includes(variant)) {
      rejections.push({
        path: `design.sectionVariants.${sectionType}`,
        reason: `"${variant}" は台帳にありません。次のいずれかにしてください: ${allowed.join(' | ')}`,
      });
    }
  }
  return rejections;
}

/** セクションの並び。header-01 が先頭・footer-01 が末尾（機械が黙って並べ替えない） */
function checkSectionOrder(output: LlmOutput): Rejection[] {
  const types = output.sections.map((s) => s.sectionType);
  const rejections: Rejection[] = [];
  if (types.indexOf('header-01') > 0) {
    rejections.push({ path: 'sections', reason: 'header-01 は先頭に置いてください' });
  }
  const footerIndex = types.indexOf('footer-01');
  if (footerIndex >= 0 && footerIndex !== types.length - 1) {
    rejections.push({ path: 'sections', reason: 'footer-01 は末尾に置いてください' });
  }
  const duplicated = types.filter((t, i) => types.indexOf(t) !== i);
  for (const type of new Set(duplicated)) {
    rejections.push({ path: 'sections', reason: `${type} が重複しています。同じセクションは1回だけ使ってください` });
  }
  return rejections;
}

/** 各セクションの content を契約と照合する */
function checkSectionContents(output: LlmOutput): Rejection[] {
  const rejections: Rejection[] = [];
  output.sections.forEach((section, index) => {
    if (!isSectionType(section.sectionType)) {
      rejections.push({
        path: `sections.${index}.sectionType`,
        reason: `"${section.sectionType}" は台帳にないセクション種別です`,
      });
      return;
    }
    const schema = schemaFor(section.sectionType);
    if (!schema) {
      rejections.push({
        path: `sections.${index}.sectionType`,
        reason: `${section.sectionType} の content 契約が未定義です（台帳の不備・実装側の修正が要る）`,
      });
      return;
    }
    const parsed = schema.safeParse(section.content);
    if (!parsed.success) {
      rejections.push(...issuesToRejections(parsed.error, `sections.${index}.content`));
    }
  });
  return rejections;
}

/**
 * testimonials-01 は content.mode で骨格が変わる。mode と items の形が食い違うと
 * 描画側が黙って quote 扱いに落とすため、ここで先に拒否する。
 */
function checkTestimonialsShape(output: LlmOutput): Rejection[] {
  const rejections: Rejection[] = [];
  output.sections.forEach((section, index) => {
    if (section.sectionType !== 'testimonials-01') return;
    const content = section.content as { mode?: unknown; items?: unknown };
    const items = Array.isArray(content.items) ? content.items : [];
    if (items.length === 0) return; // 件数不足は契約側の検証で出る
    const first = items[0] as Record<string, unknown>;
    const looksQuote = 'quote' in first;
    const expectQuote = content.mode === 'quote';
    if (looksQuote !== expectQuote) {
      rejections.push({
        path: `sections.${index}.content.items`,
        reason: `mode="${String(content.mode)}" と items の形が一致していません（quote は quote/author/role、beforeAfter は label/caption）`,
      });
    }
  });
  return rejections;
}

/**
 * プレースホルダ語の拒否。
 *
 * 「捏造はしないが "unknown" と書く」という抜け穴を塞ぐ（2026-07-23 実機で
 * `tel:unknown` が本文に出た）。契約側で該当項目を optional にしてあるので、
 * LLM は「省略して unknowns に出す」で応じられる＝差し戻しが解ける。
 */
/** 評価側（src/eval）も同じ語で採点するため export する（定義は1箇所） */
export const PLACEHOLDER = /^(unknown|未定|不明|なし|tbd|n\/a|none|null|-|―|未設定|不明です)$/i;

function checkPlaceholders(output: LlmOutput): Rejection[] {
  const rejections: Rejection[] = [];

  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (PLACEHOLDER.test(value.trim())) {
        rejections.push({
          path,
          reason: `"${value}" のようなプレースホルダを本文に書かないでください。値が無いなら**その項目ごと省略**し unknowns に出してください`,
        });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}.${i}`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    }
  };

  output.sections.forEach((section, index) => {
    walk(section.content, `sections.${index}.content`);
  });
  return rejections;
}

/** LLM の生出力（parse 前の unknown）を台帳と照合する。許可か拒否かだけを返す */
export function validateLlmOutput(raw: unknown): ValidationResult {
  const parsed = llmOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, rejections: issuesToRejections(parsed.error, '') };
  }

  const output = parsed.data;
  const rejections = [
    ...checkSectionVariants(output),
    ...checkSectionOrder(output),
    ...checkSectionContents(output),
    ...checkTestimonialsShape(output),
    ...checkPlaceholders(output),
  ];

  if (rejections.length > 0) return { ok: false, rejections };
  return { ok: true, value: output };
}

/**
 * 画像URLの機械注入。LLM は実在するURLを知り得ないので契約から外してあり、
 * ここで決定的に埋める（同じ入力→同じ画像。ランダムにしない）。
 * 実写真（Unsplash）へ切り替える時はこの1関数だけを差し替えればよい。
 */
function imageFor(seed: string, width = 1200, height = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

/** 著作権表記の西暦を現在年へ直す。LLM は学習時点の年を書くため（実機で `© 2023`） */
function fixCopyrightYear(copyright: string): string {
  return copyright.replace(/\b(19|20)\d{2}\b/g, String(new Date().getFullYear()));
}

/** セクション種別ごとに、部品が読む画像フィールドを機械が埋める */
function withMachineContent(
  sectionType: string,
  content: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const next = { ...content };
  const seed = `${sectionType}-${index}`;

  switch (sectionType) {
    case 'hero-01':
      next.imageUrl = imageFor(`${seed}-hero`, 1600, 1200);
      break;
    case 'about-01':
      next.imageUrl = imageFor(`${seed}-about`);
      break;
    case 'cta-01':
      next.imageUrl = imageFor(`${seed}-cta`);
      break;
    case 'services-01':
      if (Array.isArray(next.items)) {
        next.items = next.items.map((item, i) => ({
          ...(item as Record<string, unknown>),
          imageUrl: imageFor(`${seed}-item-${i}`, 800, 600),
        }));
      }
      break;
    case 'testimonials-01':
      if (next.mode === 'beforeAfter' && Array.isArray(next.items)) {
        next.items = next.items.map((item, i) => ({
          ...(item as Record<string, unknown>),
          beforeImageUrl: imageFor(`${seed}-before-${i}`, 800, 800),
          afterImageUrl: imageFor(`${seed}-after-${i}`, 800, 800),
        }));
      }
      break;
    case 'footer-01':
      if (typeof next.copyright === 'string') {
        next.copyright = fixCopyrightYear(next.copyright);
      }
      break;
  }

  return next;
}

/**
 * 許可された出力を既存レンダラが読む形へ組み立てる。
 * id・order・画像・年は機械が付ける（LLM には決めさせない）。
 */
export function assemblePage(output: LlmOutput): GeneratedPage {
  const design: DesignSpec = {
    heroVariant: output.design.heroVariant,
    rhythm: output.design.rhythm,
    align: output.design.align,
    sectionVariants: output.design.sectionVariants,
    cardStyle: output.design.cardStyle,
    buttonShape: output.design.buttonShape,
  };

  return {
    design,
    theme: output.theme,
    palette: output.palette,
    motion: output.motion,
    sections: output.sections.map((section, index) => ({
      id: `${section.sectionType}-${index}`,
      sectionType: section.sectionType,
      order: index,
      content: withMachineContent(section.sectionType, section.content, index),
    })),
    needsReview: output.needs_review,
    unknowns: output.unknowns,
  };
}
