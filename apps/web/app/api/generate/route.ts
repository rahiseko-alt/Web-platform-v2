/**
 * NL→要素 稼働ループの実走口（plan #5・STEP1 のローカル実走確認）。
 *
 * 当初 plan は `scripts/generate-preview.mjs` を予定していたが、素の node では
 * TS も `@/` エイリアスも解決できず（tsx/ts-node 未導入・AI は npm install 不可）、
 * dev サーバなら TS・エイリアス・.env を自動解決するため API route に変更した。
 *
 * これは STEP1 のローカル開発用ツール（顧客認証不要・マイルストーン1）。
 * OpenAI を叩いて課金が発生する未認証口なので:
 * - 本番（cloud=STEP2）では 404 で塞ぐ。公開のコスト垂れ流し口にしない
 * - 入力は zod で長さ制限（api-validation）
 * - LLM/内部エラーの詳細はクライアントへ返さずログに集約（security-runtime エラー隠蔽）
 * レートリミット基盤（Upstash 等）は STEP2 の範囲なのでここでは持たない。
 */

import { z } from 'zod';
import { generatePage } from '@/generate/generate';
import { createOpenAiClient } from '@/generate/llm/openai';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  brief: z.string().trim().min(1).max(2000),
  maxRetries: z.number().int().min(0).max(4).optional(),
});

async function handle(brief: string, maxRetries?: number): Promise<Response> {
  let client;
  try {
    client = createOpenAiClient();
  } catch {
    // キー未設定は運用ヒントとして返してよい（秘匿値そのものは含まない）
    return Response.json(
      { error: 'OPENAI_API_KEY が未設定です。.env にキーを置いてください（AI は .env を読めません）。' },
      { status: 503 },
    );
  }

  try {
    const result = await generatePage({ brief }, client, maxRetries != null ? { maxRetries } : {});
    return Response.json(result);
  } catch (error) {
    // OpenAI のエラー本文にはプロンプト等が混ざりうるため、そのまま返さない
    console.error('generate failed:', error);
    return Response.json({ error: '生成に失敗しました' }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }
  return handle(parsed.data.brief, parsed.data.maxRetries);
}

/** ブラウザから素早く試すための GET（?brief=... ）。本番では無効 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const brief = new URL(request.url).searchParams.get('brief');
  const parsed = BodySchema.pick({ brief: true }).safeParse({ brief });
  if (!parsed.success) {
    return Response.json({ error: '入力に不備があります（?brief= に依頼文を入れてください）' }, { status: 400 });
  }
  return handle(parsed.data.brief);
}
