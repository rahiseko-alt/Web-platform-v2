import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { contentEntries } from '@/db/schema';
import { requireSectionOwnership } from '@/lib/api-guard';
import { createFixedWindowLimiter } from '@/lib/rate-limiter';
import { contentPatchBodySchema, validateContentValue } from '@/lib/validation/content';

export const dynamic = 'force-dynamic';

const sectionIdParamSchema = z.string().uuid();

// 認証済みだが外部入力を受けるエンドポイントのため個別レートリミット（docs/design-notes.md §4-2 準拠）。
// ユーザー別に10秒窓・上限20回（seed-guard.tsより緩め＝編集操作は正常利用でも連投されうるため）。
const patchLimiter = createFixedWindowLimiter({ max: 20, windowMs: 10_000 });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId: rawSectionId } = await params;
  const sectionIdCheck = sectionIdParamSchema.safeParse(rawSectionId);
  if (!sectionIdCheck.success) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }
  const sectionId = sectionIdCheck.data;

  const guard = await requireSectionOwnership(sectionId, request.headers);
  if (!guard.ok) {
    return Response.json({ error: guard.message }, { status: guard.status });
  }

  const rate = patchLimiter.check(guard.userId);
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }

  const parsedBody = contentPatchBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }

  const { key } = parsedBody.data;
  const valueCheck = validateContentValue(key, parsedBody.data.value);
  if (!valueCheck.ok) {
    return Response.json({ error: '入力に不備があります' }, { status: 400 });
  }

  try {
    // (sectionId, key) の unique 制約に乗せたアトミックな upsert。
    // 旧実装は SELECT→INSERT/UPDATE の非アトミック分岐で、並列PATCHが重複行を生む
    // レースコンディションがあった（code-reviewer検出・plan Step2 advisory対処）。
    await db
      .insert(contentEntries)
      .values({
        organizationId: guard.organizationId,
        siteId: guard.siteId,
        sectionId,
        key,
        value: valueCheck.value,
        createdBy: guard.userId,
      })
      .onConflictDoUpdate({
        target: [contentEntries.sectionId, contentEntries.key],
        set: { value: valueCheck.value, updatedAt: new Date() },
      });
    return Response.json({ ok: true });
  } catch (error) {
    // 内部エラー詳細はクライアントへ返さずサーバーログに集約（エラー隠蔽・docs/design-notes.md §4-1）
    console.error('content patch failed:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
