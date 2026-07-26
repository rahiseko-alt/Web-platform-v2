/**
 * 下限割れフィールド限定の1回追加コール（plan [H] step3・字数下限対策の後段）。
 *
 * 背景（docs/ai-agent-dev-method.md §6・リサーチ結論）: 字数下限違反は LLM の構造的欠陥で、
 * プロンプトや API パラメータでは保証できない。確実な手は**生成後にコード側で下限割れを検出し、
 * 該当フィールドだけを1回追加コールで伸ばす**こと。
 *
 * 原則:
 * - 下限割れが0件なら追加コールしない（課金ゼロ）。既に良い生成に負担をかけない
 * - 事実を作らせない。追加コールは「言い換えで伸ばせ」だけ。返答は PLACEHOLDER 検証と
 *   再 validateLlmOutput を通し、破れば元を保持する（ページを壊さない・無音で悪化させない）
 * - 元より短い/同じ長さの書き換えは不採用（改善だけ採る）
 */

import { charLength, enumerateLeaves, LENGTH_RULES, splitRulePath, type Leaf } from './length-rules';
import type { LlmClient } from './llm/client';
import type { LlmOutput } from './types';
import { PLACEHOLDER, validateLlmOutput } from './validate';

export interface ExpandResult {
  /** 採用後の output（採用が無ければ元の output をそのまま返す） */
  output: LlmOutput;
  /** 追加コールが走り、1件以上の書き換えが採用されたか */
  expanded: boolean;
}

interface ShortField {
  path: string;
  leaf: Leaf;
  min: number;
  max: number;
}

/** clone の中から、契約の下限を割っている文字列リーフを集める */
function collectShortFields(output: LlmOutput): ShortField[] {
  const fields: ShortField[] = [];
  for (const rule of LENGTH_RULES) {
    const { sectionType, segments } = splitRulePath(rule.path);
    for (const section of output.sections) {
      if (section.sectionType !== sectionType) continue;
      for (const leaf of enumerateLeaves(section.content, segments, sectionType)) {
        if (charLength(leaf.value) < rule.min) {
          fields.push({ path: leaf.path, leaf, min: rule.min, max: rule.max });
        }
      }
    }
  }
  return fields;
}

const EXPAND_SYSTEM = `あなたは日本語のコピーを整える編集者です。渡された各項目の文を、指定の字数レンジに収まるよう書き直してください。

守ること:
- **事実を足さない。** 依頼文や元の文に無い実績・数値・固有名を新たに作らない。伸ばすのは表現であって事実ではない
- 元の文の意味・トーンを保つ。言い換えと具体化（誰向けか・どんな時に使うか・何が違うか）で自然に伸ばす
- "unknown" / "未定" / "不明" のようなプレースホルダを書かない
- 出力は JSON オブジェクトのみ。前後に説明文・コードフェンスを付けない。キーは渡されたパス、値は書き直した文だけ`;

/** 追加コールの user プロンプト。依頼文と、伸ばす対象だけを渡す */
function buildExpandPrompt(brief: string, fields: ShortField[]): string {
  const lines = fields.map(
    (f) => `- ${f.path}（現在 ${charLength(f.leaf.value)}字 / 目安 ${f.min}〜${f.max}字）: ${JSON.stringify(f.leaf.value)}`,
  );
  return `## 依頼文（事実の出どころ。ここに無いことは書かない）

${brief}

## 字数が足りない項目（それぞれ目安レンジに収まるよう書き直す）

${lines.join('\n')}

## 出力形式

上のパスをキー、書き直した文を値にした JSON オブジェクトだけを返してください。例:
{ "hero-01.subtitle": "書き直した文" }`;
}

/** コードフェンス等を剥がして JSON を取り出す */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const value = JSON.parse(stripped);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 下限割れフィールドを1回の追加コールで伸ばす。
 * 検証通過後・assemblePage 前の LlmOutput を受け取り、採用後の output を返す。
 */
export async function expandShortFields(
  output: LlmOutput,
  brief: string,
  client: LlmClient,
): Promise<ExpandResult> {
  // clone に対して書き戻す（元 output は不採用時にそのまま返せるよう温存する）
  const clone: LlmOutput = structuredClone(output);
  const fields = collectShortFields(clone);
  if (fields.length === 0) return { output, expanded: false };

  let raw: string;
  try {
    raw = await client.complete(EXPAND_SYSTEM, buildExpandPrompt(brief, fields));
  } catch {
    return { output, expanded: false };
  }

  const replacements = parseJsonObject(raw);
  if (!replacements) return { output, expanded: false };

  let applied = 0;
  for (const field of fields) {
    const next = replacements[field.path];
    if (typeof next !== 'string') continue;
    const trimmed = next.trim();
    // 空・プレースホルダ・元より短い/同じ長さは改善にならないので不採用
    if (!trimmed || PLACEHOLDER.test(trimmed)) continue;
    if (charLength(trimmed) <= charLength(field.leaf.value)) continue;
    field.leaf.set(trimmed);
    applied += 1;
  }

  if (applied === 0) return { output, expanded: false };

  // 書き換えた clone を機械ゲートへ通し直す。破れば元を保持（無音で悪化させない）
  const revalidated = validateLlmOutput(clone);
  if (!revalidated.ok) return { output, expanded: false };

  return { output: revalidated.value, expanded: true };
}
