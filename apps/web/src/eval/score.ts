/**
 * 単票採点（機械50点・A〜E）。
 *
 * 入力は「依頼文 + 機械が組み立てた GeneratedPage」。稼働ループ（generate.ts）には
 * 一切触れず、**保存済みの結果に対して後から回す**（評価をループの中に置かない・2026-07-20 確定）。
 *
 * 測るのは「機械制御ゲートを通った後に残る品質」だけ。ゲートが拒否する事項
 * （enum 外・項目数・並び）はここで測っても常に満点になるため配点しない。
 */

import type { GeneratedPage } from '@/generate/types';
import { PLACEHOLDER } from '@/generate/validate';
import {
  charLength,
  LENGTH_RULES,
  PER_PAGE_TOTAL,
  SECTION_COUNT_RANGE,
  splitRulePath,
  valuesAtPath,
  WEIGHTS,
  type ScoreKey,
} from './rubric';

export interface ScoreDetail {
  key: ScoreKey;
  label: string;
  score: number;
  max: number;
  /** なぜ減点されたか。エラー分析（ai-agent-dev-method §5）で人が読む */
  notes: string[];
}

export interface PageScore {
  total: number;
  max: number;
  details: Record<ScoreKey, ScoreDetail>;
}

/** 描画されない値（URL 類）は本文ではないので採点対象から外す */
const NON_TEXT_KEYS = /(href|imageurl|beforeimageurl|afterimageurl)$/i;

/** 依頼文に必ず出るが「反映されたか」の指標にならない語 */
const STOP_TERMS = new Set([
  'サイト', 'ホームページ', 'ウェブサイト', 'ウェブ', 'ページ', 'ランディングページ',
  'デザイン', 'イメージ', 'コンテンツ', 'ボタン', 'メイン',
  '制作', '作成', '依頼', '希望', '必要', '以下', '内容', '部分', '程度', '予定',
  '雰囲気', '感じ', '場合', '今回', '新規', '自分', '相談',
]);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** content 配下の「本文として描画される文字列」を集める */
export function collectTexts(page: GeneratedPage): string[] {
  const texts: string[] = [];

  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (!NON_TEXT_KEYS.test(key)) texts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, key));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) walk(childValue, childKey);
    }
  };

  for (const section of page.sections) walk(section.content, '');
  return texts;
}

/**
 * 依頼文から特徴語を抽出する。形態素解析は使わない（第一版・追加パッケージゼロ）。
 * 精度不足はエラー分析で事後に直す。ここで分類器・embedding を先に組まない（順序違反）。
 */
export function extractFeatureTerms(brief: string): string[] {
  const patterns = [/[一-鿿々]{2,}/g, /[ァ-ヺー]{2,}/g, /[A-Za-z][A-Za-z0-9]{2,}/g];
  const terms = new Set<string>();
  for (const pattern of patterns) {
    for (const matched of brief.matchAll(pattern)) {
      const term = matched[0];
      if (!STOP_TERMS.has(term)) terms.add(term);
    }
  }
  return [...terms];
}

/** A: 依頼文の反映。特徴語が本文にどれだけ現れたか */
function scoreBrief(brief: string, texts: string[]): ScoreDetail {
  const max = WEIGHTS.brief;
  const terms = extractFeatureTerms(brief);
  const haystack = texts.join('\n');

  if (terms.length === 0) {
    return { key: 'brief', label: '依頼文の反映', score: max, max, notes: ['特徴語を抽出できない依頼文（測定対象なし）'] };
  }

  const missing = terms.filter((term) => !haystack.includes(term));
  const covered = terms.length - missing.length;
  const score = round1((max * covered) / terms.length);
  const notes = [`特徴語 ${covered}/${terms.length} 件が本文に出現`];
  if (missing.length > 0) notes.push(`未反映: ${missing.slice(0, 10).join(' / ')}`);

  return { key: 'brief', label: '依頼文の反映', score, max, notes };
}

/** レンジからの外れ具合を 0〜1 に落とす */
function lengthFraction(length: number, min: number, max: number): number {
  if (length >= min && length <= max) return 1;
  if (length < min / 2 || length > max * 2) return 0;
  const bound = length < min ? min : max;
  const deviation = Math.abs(length - bound) / bound;
  return deviation <= 0.2 ? 0.6 : 0.3;
}

/** B: 文字数レンジ順守。契約の describe から抽出したレンジで測る */
function scoreLength(page: GeneratedPage): ScoreDetail {
  const max = WEIGHTS.length;
  const fractions: number[] = [];
  const notes: string[] = [];

  for (const rule of LENGTH_RULES) {
    const { sectionType, segments } = splitRulePath(rule.path);
    for (const section of page.sections) {
      if (section.sectionType !== sectionType) continue;
      for (const value of valuesAtPath(section.content, segments)) {
        const length = charLength(value);
        const fraction = lengthFraction(length, rule.min, rule.max);
        fractions.push(fraction);
        if (fraction < 1) notes.push(`${rule.path}: ${length}字（規定 ${rule.min}〜${rule.max}字）`);
      }
    }
  }

  if (fractions.length === 0) {
    return { key: 'length', label: '文字数レンジ', score: max, max, notes: ['レンジ対象のセクションが無い（測定対象なし）'] };
  }

  const mean = fractions.reduce((sum, value) => sum + value, 0) / fractions.length;
  const outOfRange = fractions.filter((value) => value < 1).length;
  return {
    key: 'length',
    label: '文字数レンジ',
    score: round1(max * mean),
    max,
    notes: [`対象 ${fractions.length} 箇所中 ${outOfRange} 箇所が規定外`, ...notes.slice(0, 10)],
  };
}

/** 依頼文が明示した要求と、それに応えるセクションの対応表 */
const REQUIREMENT_MAP: ReadonlyArray<{ label: string; keywords: string[]; sections: string[] }> = [
  { label: '料金・メニュー', keywords: ['料金', '価格', 'メニュー', 'コース', 'プラン'], sections: ['services-01'] },
  { label: '予約・問い合わせ', keywords: ['予約', '問い合わせ', '問合せ', '連絡', '来店'], sections: ['contact-01', 'cta-01'] },
  { label: 'よくある質問', keywords: ['よくある質問', 'FAQ', '疑問'], sections: ['faq-01'] },
  { label: '流れ・工程', keywords: ['流れ', '手順', '工程', 'ステップ'], sections: ['process-01'] },
  { label: '実績・お客様の声', keywords: ['口コミ', 'お客様の声', 'レビュー', '症例', 'ビフォーアフター'], sections: ['testimonials-01'] },
  { label: '強み・特徴', keywords: ['特徴', '強み', 'こだわり', '選ばれ'], sections: ['features-01'] },
];

/** C: 構成の妥当性 */
function scoreStructure(brief: string, page: GeneratedPage): ScoreDetail {
  const max = WEIGHTS.structure;
  const types = new Set(page.sections.map((section) => section.sectionType));
  const notes: string[] = [];
  let score = 0;

  for (const required of ['header-01', 'hero-01', 'footer-01']) {
    if (types.has(required)) score += 1;
    else notes.push(`${required} が無い`);
  }

  if (types.has('cta-01') || types.has('contact-01')) score += 2;
  else notes.push('CTA への到達手段（cta-01 / contact-01）が無い');

  const count = page.sections.length;
  if (count >= SECTION_COUNT_RANGE.min && count <= SECTION_COUNT_RANGE.max) score += 2;
  else notes.push(`セクション数 ${count}（規定 ${SECTION_COUNT_RANGE.min}〜${SECTION_COUNT_RANGE.max}）`);

  const requested = REQUIREMENT_MAP.filter((entry) => entry.keywords.some((keyword) => brief.includes(keyword)));
  if (requested.length === 0) {
    score += 3;
    notes.push('依頼文に明示要求なし（対応枠は満点）');
  } else {
    const answered = requested.filter((entry) => entry.sections.some((sectionType) => types.has(sectionType)));
    score += round1((3 * answered.length) / requested.length);
    const unanswered = requested.filter((entry) => !answered.includes(entry));
    if (unanswered.length > 0) notes.push(`要求に未対応: ${unanswered.map((entry) => entry.label).join(' / ')}`);
  }

  return { key: 'structure', label: '構成の妥当性', score: round1(score), max, notes };
}

/** unknowns に挙げた項目が、本文には書かれている（＝捏造）状態を検知する対応表 */
const UNKNOWN_CONTRADICTIONS: ReadonlyArray<{ label: string; keywords: string[]; present: (page: GeneratedPage) => boolean }> = [
  {
    label: '電話番号',
    keywords: ['電話', 'TEL', 'tel'],
    present: (page) => page.sections.some((section) => typeof (section.content as { phone?: unknown }).phone === 'string'),
  },
  {
    label: 'メール',
    keywords: ['メール', 'mail'],
    present: (page) => page.sections.some((section) => typeof (section.content as { email?: unknown }).email === 'string'),
  },
  {
    label: '資格・実績',
    keywords: ['資格', '実績', '受賞'],
    present: (page) =>
      page.sections.some((section) => {
        const credentials = (section.content as { credentials?: unknown }).credentials;
        return Array.isArray(credentials) && credentials.length > 0;
      }),
  },
];

/** 数値セクションを名乗る根拠が依頼文にあるか */
const NUMERIC_EVIDENCE = /[0-9０-９]|満足度|実績|創業|老舗|以上|多数/;

/** D: 誠実性。捏造・プレースホルダ・古い年号を検知する */
function scoreHonesty(brief: string, page: GeneratedPage, texts: string[]): ScoreDetail {
  const max = WEIGHTS.honesty;
  const notes: string[] = [];
  let score = 0;

  const placeholders = texts.filter((text) => PLACEHOLDER.test(text.trim()));
  if (placeholders.length === 0) score += 2;
  else notes.push(`プレースホルダ ${placeholders.length} 件: ${placeholders.slice(0, 5).join(' / ')}`);

  const footer = page.sections.find((section) => section.sectionType === 'footer-01');
  const copyright = footer ? (footer.content as { copyright?: unknown }).copyright : undefined;
  if (typeof copyright !== 'string') {
    score += 2;
    notes.push('footer-01 の著作権表記が無い（測定対象なし）');
  } else if (copyright.includes(String(new Date().getFullYear()))) {
    score += 2;
  } else {
    notes.push(`著作権表記が現在年でない: ${copyright}`);
  }

  const contradictions = UNKNOWN_CONTRADICTIONS.filter(
    (entry) => page.unknowns.some((unknown) => entry.keywords.some((keyword) => unknown.includes(keyword))) && entry.present(page),
  );
  if (contradictions.length === 0) score += 2;
  else notes.push(`unknowns に挙げながら本文にある: ${contradictions.map((entry) => entry.label).join(' / ')}`);

  const hasStats = page.sections.some((section) => section.sectionType === 'stats-01');
  if (!hasStats || NUMERIC_EVIDENCE.test(brief)) score += 2;
  else notes.push('依頼文に数値の根拠が無いのに stats-01 を採用している');

  return { key: 'honesty', label: '誠実性', score, max, notes };
}

/** E: 文言の非重複。本文レベル（15字以上）の文字列が使い回されていないか */
function scoreVariety(texts: string[]): ScoreDetail {
  const max = WEIGHTS.variety;
  const targets = texts.map((text) => text.trim()).filter((text) => charLength(text) >= 15);

  if (targets.length === 0) {
    return { key: 'variety', label: '文言の非重複', score: max, max, notes: ['15字以上の本文が無い（測定対象なし）'] };
  }

  const unique = new Set(targets);
  const duplicated = targets.length - unique.size;
  const score = round1((max * unique.size) / targets.length);
  const notes = [`本文 ${targets.length} 件中 ${duplicated} 件が重複`];
  if (duplicated > 0) {
    const seen = new Set<string>();
    const dupes = targets.filter((text) => (seen.has(text) ? true : (seen.add(text), false)));
    notes.push(`重複文: ${[...new Set(dupes)].slice(0, 3).join(' / ')}`);
  }

  return { key: 'variety', label: '文言の非重複', score, max, notes };
}

/** 依頼文1本の採点。合計は A〜E の単純和（満点 50） */
export function scorePage(brief: string, page: GeneratedPage): PageScore {
  const texts = collectTexts(page);
  const details: Record<ScoreKey, ScoreDetail> = {
    brief: scoreBrief(brief, texts),
    length: scoreLength(page),
    structure: scoreStructure(brief, page),
    honesty: scoreHonesty(brief, page, texts),
    variety: scoreVariety(texts),
  };

  const total = round1(Object.values(details).reduce((sum, detail) => sum + detail.score, 0));
  return { total, max: PER_PAGE_TOTAL, details };
}
