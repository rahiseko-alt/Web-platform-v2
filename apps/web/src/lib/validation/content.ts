import { z } from 'zod';

/**
 * content_entries 編集用の zod スキーマ群（docs/design-notes.md §5 準拠・safeParse採用）。
 * 本フェーズ（仮説#3）はテキスト・アクセントカラーのsectionスコープ編集に限定する。
 */

/** 一般テキスト編集用（見出し・本文・ラベル等）。無制限入力を拒否するため上限を設ける。 */
export const contentTextSchema = z.string().trim().min(1).max(300);

/**
 * アクセントカラー編集用。`#rrggbb` のみ許可する。
 * 大文字小文字は許容し、検証前に小文字へ正規化する（`javascript:` 等のスキーム混入はパターン不一致で拒否される）。
 */
export const contentColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().regex(/^#[0-9a-f]{6}$/, 'invalid hex color'));

/** content_entries の key のうち、色として扱うキー名（本フェーズは accentColor のみ）。 */
const COLOR_KEYS = new Set(['accentColor']);

/** PATCH `/api/content/[sectionId]` のリクエストボディ。value は本フェーズ対象（テキスト・色）を文字列で統一する。 */
export const contentPatchBodySchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().max(300),
});

export type ContentPatchBody = z.infer<typeof contentPatchBodySchema>;

export type ContentValueValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * key 種別（色 or テキスト）に応じて value を再検証する。
 * contentPatchBodySchema で構造検証済みの value に対し、key 確定後に呼び出す想定。
 */
export function validateContentValue(key: string, value: string): ContentValueValidation {
  const schema = COLOR_KEYS.has(key) ? contentColorSchema : contentTextSchema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: 'invalid content value' };
  }
  return { ok: true, value: parsed.data };
}
