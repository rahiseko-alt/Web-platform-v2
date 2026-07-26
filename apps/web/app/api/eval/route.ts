/**
 * 評価の収集口（ローカル専用・STEP1）。
 *
 * `eval/briefs.json` の依頼文を順に稼働ループへ流し、機械60点で採点して
 * `eval/runs/<timestamp>.{json,md}` に保存する。**採点は稼働ループの外側**で、
 * 生成が終わってから回す（評価をループに混ぜない・2026-07-20 確定）。
 *
 * 既存 `app/api/generate/route.ts` と同じガードを踏襲する:
 * - 本番（NODE_ENV=production）は 404。公開の課金垂れ流し口にしない
 * - 入力は zod 検証。LLM/内部エラーの詳細はクライアントへ返さずログへ
 *
 * **1回の実行で OpenAI 課金と時間が発生する**（20件で約5分）。まず `{"limit":3}` で試すこと。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { generatePage } from '@/generate/generate';
import { createOpenAiClient } from '@/generate/llm/openai';
import type { LlmClient } from '@/generate/llm/client';
import { buildMatrixMarkdown, buildRun, type EvalCaseInput } from '@/eval/report';
import { collectJudgeScores } from '@/eval/judge';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  /** 先頭から何件流すか。未指定なら全件（課金が大きいので明示を推奨） */
  limit: z.number().int().min(1).max(50).optional(),
  /** 台帳を使わず任意の依頼文で回す場合 */
  briefs: z.array(z.string().trim().min(1).max(2000)).min(1).max(50).optional(),
  maxRetries: z.number().int().min(0).max(4).optional(),
  /** 主観40点（LLM-judge）も回すか。既定 false（生成成功件数ぶん追加でLLM課金が発生するため明示指定が要る） */
  judge: z.boolean().optional(),
});

const BriefsFileSchema = z.object({
  briefs: z.array(z.object({ id: z.string(), brief: z.string().min(1) })).min(1),
});

const EVAL_DIR = path.join(process.cwd(), 'eval');

async function loadBriefs(): Promise<string[]> {
  const raw = await readFile(path.join(EVAL_DIR, 'briefs.json'), 'utf8');
  const parsed = BriefsFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    // 台帳が壊れているのを黙って空で通すと「0件で満点」になる。必ず表に出す
    throw new Error('eval/briefs.json の形式が不正です');
  }
  return parsed.data.briefs.map((entry) => entry.brief);
}

/** 1件ずつ順に生成する（並列にすると LLM 側のレート制限に当たるため） */
async function collect(briefs: string[], client: LlmClient, maxRetries?: number): Promise<EvalCaseInput[]> {
  const results: EvalCaseInput[] = [];

  for (const brief of briefs) {
    try {
      const result = await generatePage({ brief }, client, maxRetries != null ? { maxRetries } : {});
      if (result.ok) {
        results.push({ brief, page: result.page, attempts: result.attempts, expanded: result.expanded });
      } else {
        results.push({ brief, attempts: result.attempts, failure: result.rejections.map((r) => `${r.path}: ${r.reason}`).join(' / ') });
      }
    } catch (error) {
      console.error('eval generate failed:', error);
      results.push({ brief, failure: 'LLM 呼び出しに失敗しました（詳細はサーバログ）' });
    }
  }

  return results;
}

async function save(runId: string, json: string, markdown: string): Promise<string> {
  const dir = path.join(EVAL_DIR, 'runs');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${runId}.json`), json, 'utf8');
  await writeFile(path.join(dir, `${runId}.md`), markdown, 'utf8');
  return path.join('eval', 'runs', `${runId}`);
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }

  let briefs: string[];
  try {
    briefs = parsed.data.briefs ?? (await loadBriefs());
  } catch (error) {
    console.error('eval briefs load failed:', error);
    return Response.json({ error: '評価データセットを読み込めませんでした' }, { status: 500 });
  }
  if (parsed.data.limit != null) briefs = briefs.slice(0, parsed.data.limit);

  let client: LlmClient;
  try {
    client = createOpenAiClient();
  } catch {
    return Response.json(
      { error: 'OPENAI_API_KEY が未設定です。.env にキーを置いてください（AI は .env を読めません）。' },
      { status: 503 },
    );
  }

  const startedAt = new Date().toISOString();
  let cases = await collect(briefs, client, parsed.data.maxRetries);
  if (parsed.data.judge) {
    cases = await collectJudgeScores(cases, client);
  }
  const run = buildRun(cases, startedAt);
  const markdown = buildMatrixMarkdown(run);

  let savedTo: string | undefined;
  try {
    savedTo = await save(startedAt.replace(/[:.]/g, '-'), JSON.stringify(run, null, 2), markdown);
  } catch (error) {
    // 保存に失敗しても採点結果は返す（が、黙って握りつぶさない）
    console.error('eval run save failed:', error);
  }

  return Response.json({
    machineScore: run.machineScore,
    machineMax: run.machineMax,
    averagePerPage: run.averagePerPage,
    diversity: run.diversity.score,
    generated: run.generated,
    judgeScore: run.judgeScore,
    judgeMax: run.judgeMax,
    grandScore: run.grandScore,
    grandMax: run.grandMax,
    savedTo: savedTo ?? null,
    saveError: savedTo ? undefined : '結果ファイルの保存に失敗しました（詳細はサーバログ）',
    markdown,
  });
}
