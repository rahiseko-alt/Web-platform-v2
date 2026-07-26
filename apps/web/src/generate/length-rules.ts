/**
 * 本文の文字数レンジ（単一正本）。
 *
 * レンジは `section-schemas.ts` の `.describe()`（例「60〜120 字」）にしか無く、zod は
 * `min(1)` しか縛っていない。数値をどこかに書き写すと必ず二重管理になるので、
 * **説明文から機械的に抽出する**。表記が変われば抽出件数が変わり、テストが落ちて気づける。
 *
 * ここは generate 層に置く。理由: 稼働ループ（差し戻し）と評価（採点）の**両方**が同じ
 * レンジを見るため。評価側（src/eval/rubric.ts）はここを再輸出するだけで持たない。
 */

import { z } from 'zod';
import { sectionContentSchemas } from './section-schemas';

export interface LengthRule {
  /** 例: hero-01.subtitle / services-01.items[].description */
  path: string;
  min: number;
  max: number;
}

/**
 * 「60〜120 字」形式だけを拾う。「20字前後」「3〜6 項目」は対象外（レンジではない/字ではない）。
 * 対象外を無理に解釈しない＝測れないものは測らない。
 */
const RANGE_PATTERN = /(\d+)\s*[〜～~-]\s*(\d+)\s*字/;

function collectRules(schema: z.ZodTypeAny, path: string, out: LengthRule[]): void {
  const description = schema.description;
  if (description) {
    const matched = RANGE_PATTERN.exec(description);
    if (matched) {
      out.push({ path, min: Number(matched[1]), max: Number(matched[2]) });
    }
  }

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) {
    collectRules(schema._def.innerType as z.ZodTypeAny, path, out);
    return;
  }
  if (schema instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(schema.shape as Record<string, z.ZodTypeAny>)) {
      collectRules(child, `${path}.${key}`, out);
    }
    return;
  }
  if (schema instanceof z.ZodArray) {
    collectRules(schema.element as z.ZodTypeAny, `${path}[]`, out);
    return;
  }
  if (schema instanceof z.ZodUnion) {
    for (const option of schema.options as z.ZodTypeAny[]) {
      collectRules(option, path, out);
    }
  }
}

function extractLengthRules(): LengthRule[] {
  const rules: LengthRule[] = [];
  for (const [sectionType, schema] of Object.entries(sectionContentSchemas)) {
    collectRules(schema as z.ZodTypeAny, sectionType, rules);
  }
  if (rules.length === 0) {
    // 表記が変わって全滅した状態。黙って「制約なし」で通すと薄い本文が素通りする
    throw new Error('文字数レンジを1件も抽出できません。section-schemas.ts の describe 表記を確認してください');
  }
  return rules;
}

/** 抽出済みの文字数レンジ（プロセス内で1回だけ計算する） */
export const LENGTH_RULES: readonly LengthRule[] = extractLengthRules();

/** rule.path をセクション種別と、content 起点のセグメント列に割る */
export function splitRulePath(path: string): { sectionType: string; segments: string[] } {
  const [sectionType, ...segments] = path.split('.');
  return { sectionType, segments };
}

/** レンジ対象の終端（文字列リーフ）1つ。`set` で同じ位置へ書き戻せる */
export interface Leaf {
  /** 具体パス（配列は `items[0]` のように添字を含む）。basePath 起点 */
  path: string;
  value: string;
  /** 元の container を直接書き換える（clone に対して使うこと） */
  set: (next: string) => void;
}

/**
 * セグメント列（`items[]` 形式を含む）を辿り、終端の文字列リーフを列挙する。
 * `valuesAtPath`（値の収集）と expand-length（値の書き戻し）が同じ walk を共有する。
 * `basePath` は具体パスの先頭（通常はセクション種別）。
 */
export function enumerateLeaves(root: unknown, segments: string[], basePath = ''): Leaf[] {
  const leaves: Leaf[] = [];

  const walk = (value: unknown, rest: string[], label: string): void => {
    // segments を使い切った / 空で呼ばれた場合は列挙する葉が無い（旧 valuesAtPath の空配列相当）
    if (rest.length === 0) return;
    if (!value || typeof value !== 'object') return;

    const [head, ...tail] = rest;
    const isArray = head.endsWith('[]');
    const key = isArray ? head.slice(0, -2) : head;
    const container = value as Record<string, unknown>;
    const next = container[key];

    if (isArray) {
      if (!Array.isArray(next)) return;
      const arr = next as unknown[];
      arr.forEach((item, i) => {
        const itemLabel = `${label}.${key}[${i}]`;
        if (tail.length === 0) {
          if (typeof item === 'string') {
            leaves.push({ path: itemLabel, value: item, set: (v) => { arr[i] = v; } });
          }
          return;
        }
        walk(item, tail, itemLabel);
      });
      return;
    }

    const childLabel = `${label}.${key}`;
    if (tail.length === 0) {
      if (typeof next === 'string') {
        leaves.push({ path: childLabel, value: next, set: (v) => { container[key] = v; } });
      }
      return;
    }
    walk(next, tail, childLabel);
  };

  walk(root, segments, basePath);
  return leaves;
}

/** セグメント列（`items[]` 形式を含む）を辿って文字列だけを集める（enumerateLeaves へ委譲） */
export function valuesAtPath(root: unknown, segments: string[]): string[] {
  return enumerateLeaves(root, segments).map((leaf) => leaf.value);
}

/** 文字数はコードポイントで数える（絵文字・サロゲートペアで実長がずれないように） */
export function charLength(value: string): number {
  return [...value.trim()].length;
}
