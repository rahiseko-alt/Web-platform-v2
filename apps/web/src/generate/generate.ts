/**
 * NL→要素 稼働ループ本体（plan #2・B図の実体）。
 *
 * B稼働順序: 入力 → プロンプト+情報をLLMへ → LLM判断 → 機械制御ゲート →
 *   拒否なら差し戻して再試行 / 許可なら機械が組み立て → 出力。
 *
 * 原則（docs/design-notes.md §6-1 / plan constraint）:
 * - LLM が返すのは要素の値だけ。組み立て（id/order 採番）は validate.ts が行う
 * - 失敗を黙って握りつぶさない。JSON でない・台帳外は rejection として表に出し差し戻す
 * - 既定値での無音フォールバックはしない（評価が回らなくなるため）
 *
 * 評価（採点）はこのループの中に置かない（2026-07-20 マスター確定）。
 * ここは稼働だけを担い、結果の保存・採点は後続の評価系が非同期に行う。
 */

import { expandShortFields } from './expand-length';
import { buildRetryPrompt, buildSystemPrompt, buildUserPrompt } from './prompt';
import type { GeneratedPage, GenerateInput, Rejection } from './types';
import { assemblePage, validateLlmOutput } from './validate';
import type { LlmClient } from './llm/client';

export interface GenerateOptions {
  /** 差し戻し再試行の上限。総試行回数 = maxRetries + 1（初回 + 差し戻し） */
  maxRetries?: number;
  /**
   * 検証通過後、下限割れの本文を1回の追加コールで伸ばすか（既定 true）。
   * 追加コールは下限割れが0件なら発火しない（既に良い生成には課金増なし）。
   */
  expandLength?: boolean;
}

export type GenerateResult =
  | { ok: true; page: GeneratedPage; attempts: number; expanded: boolean }
  | { ok: false; rejections: Rejection[]; attempts: number };

const DEFAULT_MAX_RETRIES = 2;

/** コードフェンス等を剥がして JSON 本体を取り出す。剥がしても駄目なら失敗を返す */
function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch {
    return { ok: false };
  }
}

/**
 * 差し戻し時に LLM へ渡す user プロンプト。
 * ステートレスな単発呼び出しのため、依頼文・前回出力・拒否理由を毎回まとめて渡す
 * （会話履歴に頼らない＝client の実装に依存しない）。
 */
function buildRetryUserPrompt(brief: string, previousRaw: string, rejections: Rejection[]): string {
  return `${buildUserPrompt(brief)}

## 前回のあなたの出力

${previousRaw}

${buildRetryPrompt(rejections)}`;
}

/**
 * 依頼文1本から、機械が組み立てた GeneratedPage を得る。
 * 台帳外・JSON 崩れは差し戻して再試行し、上限に達したら拒否理由を集約して返す。
 */
export async function generatePage(
  input: GenerateInput,
  client: LlmClient,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const expandLength = options.expandLength ?? true;
  const system = buildSystemPrompt();

  let userPrompt = buildUserPrompt(input.brief);
  let lastRejections: Rejection[] = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const raw = await client.complete(system, userPrompt);

    const parsed = parseJson(raw);
    if (!parsed.ok) {
      lastRejections = [
        {
          path: '',
          reason: 'JSON として読めませんでした。前後に説明文やコードフェンスを付けず、JSON オブジェクトだけを返してください',
        },
      ];
      userPrompt = buildRetryUserPrompt(input.brief, raw, lastRejections);
      continue;
    }

    const result = validateLlmOutput(parsed.value);
    if (result.ok) {
      // 検証通過後、下限割れの本文だけを1回の追加コールで伸ばす（0件なら発火しない）。
      // 追加コールが失敗しても元の output で続行する（ここでページを落とさない）。
      const expansion = expandLength
        ? await expandShortFields(result.value, input.brief, client)
        : { output: result.value, expanded: false };
      return { ok: true, page: assemblePage(expansion.output), attempts: attempt, expanded: expansion.expanded };
    }

    lastRejections = result.rejections;
    userPrompt = buildRetryUserPrompt(input.brief, raw, result.rejections);
  }

  return { ok: false, rejections: lastRejections, attempts: maxRetries + 1 };
}
