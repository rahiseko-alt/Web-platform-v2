import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { requireSiteOwnership } from '@/lib/api-guard';
import { getEditableSiteSections } from '@/db/queries/site-render';
import { EditorForm } from './EditorForm';

export const dynamic = 'force-dynamic';

const siteIdParamSchema = z.string().uuid();

/** content_entries の accentColor キー・未設定時の既定値（テーマ既定accentと同一。src/lib/validation/content.ts と対応）。 */
const ACCENT_KEY = 'accentColor';
const DEFAULT_ACCENT = '#3b82f6';

/**
 * サイト編集画面（仮説#3・編集境界プロトタイプ、Server Component）。
 * middleware.ts の Cookie 存在チェックは optimistic check のため、ここで
 * requireSiteOwnership により実体のセッション有効性・organization 所有権を再検証する
 * （api-guard.ts の多層防御思想・docs/design-notes.md §4-3 IDOR対策準拠）。
 * 所有権チェックに失敗した場合は 403/404/401 いずれも notFound() へ丸める
 * （エラー隠蔽・docs/design-notes.md §4-1 準拠。詳細ステータスはAPI側でのみ区別する）。
 */
export default async function EditorPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteIdCheck = siteIdParamSchema.safeParse(rawSiteId);
  if (!siteIdCheck.success) {
    notFound();
  }
  const siteId = siteIdCheck.data;

  const requestHeaders = await headers();
  // next/headers の ReadonlyHeaders は fetch API Headers から mutator を除いた型のため、
  // read-only 用途（getSession内部のget呼出のみ）に限定して安全にキャストする。
  const guard = await requireSiteOwnership(siteId, requestHeaders as unknown as Headers);
  if (!guard.ok) {
    notFound();
  }

  const rawSections = await getEditableSiteSections(siteId);
  const sections = rawSections.map((section) => {
    const textFields = section.fields.filter((field) => field.key !== ACCENT_KEY);
    const accentField = section.fields.find((field) => field.key === ACCENT_KEY);
    return {
      id: section.id,
      sectionType: section.sectionType,
      textFields,
      accentColor: accentField?.value ?? DEFAULT_ACCENT,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-heading text-xl font-bold text-text">サイト編集</h1>
      <p className="mt-1 text-sm">
        <a
          href={`/preview/${siteId}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          プレビューを開く
        </a>
      </p>
      <EditorForm sections={sections} />
    </main>
  );
}
