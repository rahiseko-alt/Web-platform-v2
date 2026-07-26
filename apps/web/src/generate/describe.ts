/**
 * zod スキーマ → プロンプトへ埋め込む台帳テキスト。
 *
 * 台帳（section-schemas.ts）を人が二重管理しないための変換器。プロンプトに書いた枠と
 * 機械が検証する枠が同じ定義から生成されるので、片方だけ直して乖離する事故が起きない。
 */

import { z } from 'zod';

type Def = { typeName: string; [key: string]: unknown };

function defOf(schema: z.ZodTypeAny): Def {
  return schema._def as unknown as Def;
}

function rangeLabel(def: Def): string {
  const min = (def.minLength as { value: number } | null)?.value;
  const max = (def.maxLength as { value: number } | null)?.value;
  if (min !== undefined && max !== undefined) return min === max ? `${min}件` : `${min}〜${max}件`;
  if (min !== undefined) return `${min}件以上`;
  if (max !== undefined) return `${max}件以下`;
  return '件数指定なし';
}

/** 型名の日本語ラベル。未知の型は typeName をそのまま出す（黙って落とさない） */
function typeLabel(schema: z.ZodTypeAny): string {
  const def = defOf(schema);
  switch (def.typeName) {
    case 'ZodString':
      return '文字列';
    case 'ZodBoolean':
      return '真偽値';
    case 'ZodEnum':
      return `次のいずれか: ${(def.values as string[]).join(' | ')}`;
    case 'ZodArray':
      return `配列(${rangeLabel(def)})`;
    case 'ZodObject':
      return 'オブジェクト';
    case 'ZodUnion':
      return '次のいずれかの形';
    default:
      return def.typeName;
  }
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean } {
  const def = defOf(schema);
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
    const { inner } = unwrap(def.innerType as z.ZodTypeAny);
    return { inner, optional: true };
  }
  return { inner: schema, optional: false };
}

function describeNode(schema: z.ZodTypeAny, indent: string, lines: string[]): void {
  const def = defOf(schema);

  if (def.typeName === 'ZodObject') {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    for (const [key, raw] of Object.entries(shape)) {
      const { inner, optional } = unwrap(raw as z.ZodTypeAny);
      const desc = (raw as z.ZodTypeAny).description ?? inner.description;
      const suffix = optional ? '（任意）' : '';
      lines.push(`${indent}- ${key}${suffix}: ${typeLabel(inner)}${desc ? ` — ${desc}` : ''}`);
      describeNode(inner, `${indent}  `, lines);
    }
    return;
  }

  if (def.typeName === 'ZodArray') {
    describeNode(def.type as z.ZodTypeAny, indent, lines);
    return;
  }

  if (def.typeName === 'ZodUnion') {
    const options = def.options as z.ZodTypeAny[];
    options.forEach((option, i) => {
      lines.push(`${indent}- 形${i + 1}:`);
      describeNode(option, `${indent}  `, lines);
    });
  }
}

/** セクション1つ分の content 契約をテキスト化する */
export function describeSchema(schema: z.ZodTypeAny): string {
  const lines: string[] = [];
  describeNode(schema, '  ', lines);
  return lines.join('\n');
}
