/**
 * 主観40点採点（LLM-judge・plan: parallel-hopping-island）。
 *
 * ai-agent-dev-method.md §6 の二層構成の後半。機械60点（score.ts/diversity.ts）が
 * 「ゲートを通った後に残る品質」の決定的アサーションなのに対し、こちらは
 * トーン一致・コピーの主観品質・総合的な完成度という機械では測れない軸を LLM に採点させる。
 *
 * **人間較正は未実施**（判定基準の正本は人間・CLAUDE.md §1）。judge 単独運用しないため、
 * このスコアは常に「参考値」として扱うこと（report.ts のマークダウン出力で明記する）。
 *
 * 採点そのものはここでは持たず、稼働ループ（generate.ts）とは独立に、保存済みの
 * GeneratedPage に対して後から回す（評価をループに混ぜない・2026-07-20 確定を踏襲）。
 */

import { z } from 'zod';
import type { GeneratedPage } from '@/generate/types';
import type { LlmClient } from '@/generate/llm/client';
import type { EvalCaseInput } from '@/eval/report';
import { collectTexts } from './score';
import { JUDGE_TOTAL, JUDGE_WEIGHTS, type JudgeKey } from './rubric';

export interface JudgeDetail {
  key: JudgeKey;
  label: string;
  score: number;
  max: number;
  /** LLM が返した採点理由（人間較正で読む） */
  notes: string[];
}

export interface JudgeScore {
  total: number;
  max: number;
  details: Record<JudgeKey, JudgeDetail>;
}

const JUDGE_LABELS: Record<JudgeKey, string> = {
  tone: 'トーン・文脈適合',
  copyQuality: 'コピーの主観品質',
  overall: '総合的な完成度',
};

const JUDGE_SYSTEM = `あなたは商用ランディングページ(LP)の品質を審査する専門家です。依頼文と、機械が組み立てたページの構造化データを渡します。
以下の3項目それぞれを0〜満点の範囲で採点し、日本語で1文の採点理由(note)を添えてください。

- tone（満点15）: 依頼文の業種・ターゲット・要望の空気感に、コピーと選ばれたデザイントークン（theme/palette/motion）が合っているか
- copyQuality（満点15）: 文章として自然で具体的か。定型的で「AIっぽい」紋切り型の言い回しになっていないか
- overall（満点10）: 依頼文の意図をどれだけ汲んだ「売れる」LPに仕上がっているかの総合判断

守ること:
- 採点は厳しく行うこと。満点は「本当に非の打ち所がない」時だけ付けること
- 出力は JSON オブジェクトのみ。前後に説明文・コードフェンスを付けない
- 形式: {"tone":{"score":number,"note":string},"copyQuality":{"score":number,"note":string},"overall":{"score":number,"note":string}}`;

function buildJudgePrompt(brief: string, page: GeneratedPage): string {
  const texts = collectTexts(page);
  return `## 依頼文

${brief}

## 生成ページのデザイントークン

theme: ${page.theme} / palette: ${page.palette} / motion: ${page.motion}

## 本文テキスト（描画される文字列のみ）

${texts.map((text, index) => `${index + 1}. ${text}`).join('\n')}`;
}

const JudgeAxisSchema = z.object({
  score: z.number(),
  // JSON mode の LLM は「理由なし」を null で返すことがある（検証パネル②指摘）。
  // undefined と null の両方を許容し、後段で空文字に正規化する
  note: z.string().nullable().optional(),
});

const JudgeResponseSchema = z.object({
  tone: JudgeAxisSchema,
  copyQuality: JudgeAxisSchema,
  overall: JudgeAxisSchema,
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** コードフェンス等を剥がして JSON を取り出す（expand-length.ts と同じ方針） */
function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function buildJudgeScore(parsed: z.infer<typeof JudgeResponseSchema>): JudgeScore {
  const detail = (key: JudgeKey): JudgeDetail => {
    const axis = parsed[key];
    const max = JUDGE_WEIGHTS[key];
    // LLM が範囲外を返す事故に備えてクランプする
    const score = round1(Math.max(0, Math.min(max, axis.score)));
    // note が null/undefined/空文字ならノート無しとして扱う
    return { key, label: JUDGE_LABELS[key], score, max, notes: axis.note ? [axis.note] : [] };
  };

  const details: Record<JudgeKey, JudgeDetail> = {
    tone: detail('tone'),
    copyQuality: detail('copyQuality'),
    overall: detail('overall'),
  };
  const total = round1(Object.values(details).reduce((sum, d) => sum + d.score, 0));
  return { total, max: JUDGE_TOTAL, details };
}

/**
 * 1ページを主観40点で採点する。
 * 失敗（LLM呼び出し・JSON parse・スキーマ不一致）は空 catch にしない: サーバログへ出し、
 * `judgeFailure` に人間が読める理由を返す（`judge` は付けない＝平均から除外）。
 */
export async function judgePage(
  brief: string,
  page: GeneratedPage,
  client: LlmClient,
): Promise<{ judge?: JudgeScore; judgeFailure?: string }> {
  let raw: string;
  try {
    raw = await client.complete(JUDGE_SYSTEM, buildJudgePrompt(brief, page));
  } catch (error) {
    console.error('judge LLM call failed:', error);
    return { judgeFailure: 'LLM 呼び出しに失敗しました（詳細はサーバログ）' };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripCodeFence(raw));
  } catch (error) {
    console.error('judge response JSON parse failed:', error, raw);
    return { judgeFailure: 'judge 応答の JSON parse に失敗しました（詳細はサーバログ）' };
  }

  const result = JudgeResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error('judge response schema mismatch:', result.error.message, raw);
    return { judgeFailure: `judge 応答の形式が不正です: ${result.error.issues[0]?.message ?? '不明'}` };
  }

  return { judge: buildJudgeScore(result.data) };
}

/**
 * 生成に成功した case（`page` を持つもの）だけ順番に judge を回す。
 * レート制限回避のため直列で呼ぶ（route.ts の `collect()` と同じ方針）。
 */
export async function collectJudgeScores(cases: EvalCaseInput[], client: LlmClient): Promise<EvalCaseInput[]> {
  const results: EvalCaseInput[] = [];
  for (const entry of cases) {
    if (!entry.page) {
      results.push(entry);
      continue;
    }
    const judged = await judgePage(entry.brief, entry.page, client);
    results.push({ ...entry, ...judged });
  }
  return results;
}
