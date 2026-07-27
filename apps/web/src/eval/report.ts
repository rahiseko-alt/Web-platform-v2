/**
 * 評価結果の集計と提示（docs/design-notes.md §6-3「テストケース×項目のマトリクス」）。
 *
 * 渡され方は2経路:
 * - JSON: Claude が読んで落ちたケースを特定し、エラー分析へ回す
 * - Markdown: マスターが1枚で採否を判断する
 *
 * 判定はここでは行わない。**合格線80は主観40（LLM-judge）と合算して初めて出る**ため、
 * 第一版が出すのは「機械60点満点中の得点と内訳」まで。
 */

import { scoreDiversity, type DiversityScore } from './diversity';
import { GRAND_TOTAL, JUDGE_TOTAL, MACHINE_TOTAL, PASS_LINE, PER_PAGE_TOTAL, WEIGHTS, type ScoreKey } from './rubric';
import { scorePage, type PageScore } from './score';
import type { JudgeScore } from './judge';
import type { GeneratedPage } from '@/generate/types';

/** 1件の生成結果。生成自体に失敗した場合は page を持たない */
export interface EvalCaseInput {
  brief: string;
  page?: GeneratedPage;
  attempts?: number;
  /** 生成が失敗した理由（機械制御ゲートの拒否・API 失敗など） */
  failure?: string;
  /** 字数下限割れで追加コールが発火し、伸ばしが採用されたか（expand-length.ts） */
  expanded?: boolean;
  /** 主観40点（LLM-judge）。`judge:true` 指定時のみ、生成成功 case に付く */
  judge?: JudgeScore;
  /** judge 呼び出し・応答parseの失敗理由（付いていれば judge は無く、平均から除外される） */
  judgeFailure?: string;
}

export interface EvalCaseResult extends EvalCaseInput {
  score?: PageScore;
}

export interface EvalRun {
  startedAt: string;
  cases: EvalCaseResult[];
  diversity: DiversityScore;
  /** 生成に成功した件数 / 全件 */
  generated: { ok: number; total: number };
  /** 字数追加コールが発火・採用された件数（成功件数のうち） */
  expandedFired: number;
  /** 単票平均（50点満点） */
  averagePerPage: number;
  /** 機械60点満点での得点 = 単票平均 + 多様性 */
  machineScore: number;
  machineMax: number;
  /** judge が成功した件数（生成成功件数のうち） */
  judgeSucceeded: number;
  /** 主観40点満点。judge を1件も実行していなければ undefined（未較正の参考値） */
  judgeScore?: number;
  judgeMax: number;
  /** machineScore + judgeScore。judgeScore が無ければ undefined */
  grandScore?: number;
  grandMax: number;
}

const COLUMN_ORDER: ScoreKey[] = ['brief', 'length', 'structure', 'honesty', 'variety'];
const COLUMN_LABELS: Record<ScoreKey, string> = {
  brief: 'A 依頼文反映',
  length: 'B 文字数',
  structure: 'C 構成',
  honesty: 'D 誠実性',
  variety: 'E 非重複',
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function truncate(text: string, limit = 24): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length <= limit ? chars.join('') : `${chars.slice(0, limit).join('')}…`;
}

/** 採点済みの run を組み立てる。採点そのものはここでは持たず score.ts / diversity.ts に委ねる */
export function buildRun(inputs: EvalCaseInput[], startedAt = new Date().toISOString()): EvalRun {
  const cases: EvalCaseResult[] = inputs.map((input) => ({
    ...input,
    score: input.page ? scorePage(input.brief, input.page) : undefined,
  }));

  const pages = cases.map((entry) => entry.page).filter((page): page is GeneratedPage => page != null);
  const scored = cases.map((entry) => entry.score).filter((score): score is PageScore => score != null);
  const averagePerPage = scored.length === 0 ? 0 : round1(scored.reduce((sum, score) => sum + score.total, 0) / scored.length);
  const diversity = scoreDiversity(pages);
  const machineScore = round1(averagePerPage + diversity.score);

  const judged = cases.map((entry) => entry.judge).filter((judge): judge is JudgeScore => judge != null);
  const judgeScore = judged.length === 0 ? undefined : round1(judged.reduce((sum, judge) => sum + judge.total, 0) / judged.length);

  return {
    startedAt,
    cases,
    diversity,
    generated: { ok: pages.length, total: cases.length },
    expandedFired: cases.filter((entry) => entry.expanded).length,
    averagePerPage,
    machineScore,
    machineMax: MACHINE_TOTAL,
    judgeSucceeded: judged.length,
    judgeScore,
    judgeMax: JUDGE_TOTAL,
    grandScore: judgeScore == null ? undefined : round1(machineScore + judgeScore),
    grandMax: GRAND_TOTAL,
  };
}

function judgeCell(entry: EvalCaseResult): string {
  if (entry.judge) return `**${entry.judge.total}/${JUDGE_TOTAL}**`;
  if (entry.judgeFailure) return 'judge失敗';
  return '—';
}

function matrixRows(run: EvalRun, judgeRequested: boolean): string[] {
  return run.cases.map((entry, index) => {
    const label = `${index + 1}. ${truncate(entry.brief)}`;
    const cells = [label];

    if (!entry.score) {
      cells.push(...COLUMN_ORDER.map(() => '—'), '**生成失敗**');
      if (judgeRequested) cells.push('—');
      cells.push(entry.failure ?? '生成失敗');
      return `| ${cells.join(' | ')} |`;
    }

    cells.push(...COLUMN_ORDER.map((key) => `${entry.score!.details[key].score}/${WEIGHTS[key]}`));
    cells.push(`**${entry.score.total}/${PER_PAGE_TOTAL}**`);
    if (judgeRequested) cells.push(judgeCell(entry));

    const weakest = COLUMN_ORDER.map((key) => entry.score!.details[key])
      .filter((detail) => detail.score < detail.max)
      .sort((a, b) => a.score / a.max - b.score / b.max)[0];
    cells.push(weakest ? `${COLUMN_LABELS[weakest.key]}: ${weakest.notes[0] ?? ''}` : '—');

    return `| ${cells.join(' | ')} |`;
  });
}

function averageRow(run: EvalRun, judgeRequested: boolean): string {
  const scored = run.cases.map((entry) => entry.score).filter((score): score is PageScore => score != null);
  const cells = [
    '**平均**',
    ...COLUMN_ORDER.map((key) => {
      if (scored.length === 0) return '—';
      const mean = scored.reduce((sum, score) => sum + score.details[key].score, 0) / scored.length;
      return `${round1(mean)}/${WEIGHTS[key]}`;
    }),
    `**${run.averagePerPage}/${PER_PAGE_TOTAL}**`,
  ];
  if (judgeRequested) cells.push(run.judgeScore == null ? '—' : `**${run.judgeScore}/${JUDGE_TOTAL}**`);
  cells.push('—');
  return `| ${cells.join(' | ')} |`;
}

/** マスターが1枚で採否を判断するための表 */
export function buildMatrixMarkdown(run: EvalRun): string {
  const judgeRequested = run.cases.some((entry) => entry.judge != null || entry.judgeFailure != null);

  const headerCells = ['依頼文', ...COLUMN_ORDER.map((key) => COLUMN_LABELS[key]), '合計'];
  if (judgeRequested) headerCells.push('G 主観(40)');
  headerCells.push('最大の減点');
  const header = `| ${headerCells.join(' | ')} |`;
  const divider = `|${headerCells.map(() => '---').join('|')}|`;

  const diversityRows = run.diversity.axes.map(
    (axis) => `| ${axis.axis} | ${axis.distinct} 種類 | 上限 ${axis.cap} | ${axis.fraction} |`,
  );

  const scoreLines = [
    `**機械スコア: ${run.machineScore} / ${run.machineMax}**（単票平均 ${run.averagePerPage}/${PER_PAGE_TOTAL} ＋ 多様性 ${run.diversity.score}/${run.diversity.max}）`,
  ];
  let captionLine: string;
  if (judgeRequested) {
    scoreLines.push(`**LLM-judge: ${run.judgeScore ?? '—'} / ${run.judgeMax}**（成功 ${run.judgeSucceeded}/${run.generated.ok} 件）`);
    if (run.grandScore != null) {
      scoreLines.push(`**合計(未較正): ${run.grandScore} / ${run.grandMax}**（合格線${PASS_LINE}）`);
    }
    captionLine = '> judge は人間較正前の参考値（judge単独運用しない・docs/design-notes.md §6-2）。最終合否はマスターの目視確認を要する。';
  } else {
    captionLine = `> 合格線${PASS_LINE}は主観40（LLM-judge）との合算で判定する。この表だけでは合否は出ない。`;
  }

  return [
    `# 評価レポート（機械60点${judgeRequested ? '＋主観40点' : ''}）— ${run.startedAt}`,
    '',
    ...scoreLines,
    `生成成功 ${run.generated.ok}/${run.generated.total} 件・字数追加コール発火 ${run.expandedFired}/${run.generated.ok} 件`,
    '',
    captionLine,
    '',
    '## テストケース × 項目',
    '',
    header,
    divider,
    ...matrixRows(run, judgeRequested),
    averageRow(run, judgeRequested),
    '',
    '## F 多様性（セット単位）',
    '',
    `**${run.diversity.score} / ${run.diversity.max}** — ${run.diversity.notes.join(' / ')}`,
    '',
    '| 軸 | 実現値 | 到達上限 | 達成率 |',
    '|---|---|---|---|',
    ...diversityRows,
    '',
  ].join('\n');
}
