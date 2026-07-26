import { put } from '@vercel/blob';
import { requireSectionOwnership } from '@/lib/api-guard';
import { createFixedWindowLimiter } from '@/lib/rate-limiter';
import { db } from '@/db';
import { contentEntries } from '@/db/schema';

export const dynamic = 'force-dynamic';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// アップロードは重い処理のため個別レートリミット（security-runtime.md準拠）。
// PATCH（テキスト/色）より厳しめに設定。
const uploadLimiter = createFixedWindowLimiter({ max: 5, windowMs: 10_000 });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;

  const guard = await requireSectionOwnership(sectionId, request.headers);
  if (!guard.ok) {
    return Response.json({ error: guard.message }, { status: guard.status });
  }

  const rate = uploadLimiter.check(guard.userId);
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES || file.size === 0) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }

  try {
    const blob = await put(`sections/${sectionId}/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    await db
      .insert(contentEntries)
      .values({
        organizationId: guard.organizationId,
        siteId: guard.siteId,
        sectionId,
        key: 'imageUrl',
        value: blob.url,
        createdBy: guard.userId,
      })
      .onConflictDoUpdate({
        target: [contentEntries.sectionId, contentEntries.key],
        set: { value: blob.url, updatedAt: new Date() },
      });

    return Response.json({ ok: true, url: blob.url });
  } catch (error) {
    console.error('image upload failed:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
