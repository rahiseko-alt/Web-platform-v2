'use client';

import { useState } from 'react';

export type EditableSectionViewModel = {
  id: string;
  sectionType: string;
  textFields: Array<{ key: string; value: string }>;
  accentColor: string;
};

type FieldStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'success'; message: string }
  | { state: 'error'; message: string };

/**
 * PATCH `/api/content/[sectionId]` 呼出。既存API（zod検証・IDOR対策・onConflictDoUpdate）は
 * 前セッションで完成済みのためクライアント側はfetchするだけでよい。
 */
async function patchContent(sectionId: string, key: string, value: string): Promise<void> {
  const response = await fetch(`/api/content/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) {
    // security-runtime.md エラー隠蔽: サーバーが返す抽象メッセージのみ表示する
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? '保存に失敗しました');
  }
}

function ImageUploadRow({ sectionId }: { sectionId: string }) {
  const [status, setStatus] = useState<FieldStatus>({ state: 'idle' });

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus({ state: 'saving' });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/content/${sectionId}/image`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'アップロードに失敗しました');
      }
      setStatus({ state: 'success', message: 'アップロードしました' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'アップロードに失敗しました',
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <label className="w-32 shrink-0 text-sm text-text-muted">imageUrl</label>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} />
      {status.state === 'saving' && <span className="text-sm text-text-muted">送信中...</span>}
      {status.state === 'success' && (
        <span className="text-sm text-green-600">{status.message}</span>
      )}
      {status.state === 'error' && <span className="text-sm text-red-600">{status.message}</span>}
    </div>
  );
}

function FieldRow({
  sectionId,
  fieldKey,
  initialValue,
  type,
}: {
  sectionId: string;
  fieldKey: string;
  initialValue: string;
  type: 'text' | 'color';
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<FieldStatus>({ state: 'idle' });

  async function handleSave() {
    setStatus({ state: 'saving' });
    try {
      await patchContent(sectionId, fieldKey, value);
      setStatus({ state: 'success', message: '保存しました' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : '保存に失敗しました',
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <label className="w-32 shrink-0 text-sm text-text-muted">{fieldKey}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={300}
        className={
          type === 'color'
            ? 'h-9 w-16 border border-border'
            : 'flex-1 min-w-40 border border-border px-2 py-1 text-sm'
        }
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={status.state === 'saving'}
        className="rounded-md bg-primary px-3 py-1 text-sm text-primary-contrast disabled:opacity-50"
      >
        {status.state === 'saving' ? '保存中...' : '保存'}
      </button>
      {status.state === 'success' && (
        <span className="text-sm text-green-600">{status.message}</span>
      )}
      {status.state === 'error' && <span className="text-sm text-red-600">{status.message}</span>}
    </div>
  );
}

/** セクションごとにテキストフィールド＋アクセントカラーのcolor inputを表示するフォーム。 */
export function EditorForm({ sections }: { sections: EditableSectionViewModel[] }) {
  if (sections.length === 0) {
    return <p className="mt-6 text-sm text-text-muted">編集可能なセクションがありません。</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {sections.map((section) => (
        <section key={section.id} className="rounded-lg border border-border p-4">
          <h2 className="font-heading text-sm font-bold text-text-muted">{section.sectionType}</h2>
          <div className="mt-2 divide-y divide-border">
            {section.textFields.map((field) => (
              <FieldRow
                key={field.key}
                sectionId={section.id}
                fieldKey={field.key}
                initialValue={field.value}
                type="text"
              />
            ))}
            <FieldRow
              sectionId={section.id}
              fieldKey="accentColor"
              initialValue={section.accentColor}
              type="color"
            />
            <ImageUploadRow sectionId={section.id} />
          </div>
        </section>
      ))}
    </div>
  );
}
