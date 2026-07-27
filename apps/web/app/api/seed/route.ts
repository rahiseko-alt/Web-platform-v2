import { buildSeed } from '@/db/seed';
import { evaluateSeedGuard } from '@/lib/seed-guard';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const guard = evaluateSeedGuard(request.headers.get('authorization'));
  if (!guard.ok) {
    const headers: Record<string, string> = {};
    if (guard.status === 429 && guard.retryAfterSec != null) {
      headers['Retry-After'] = String(guard.retryAfterSec);
    }
    return Response.json({ error: guard.message }, { status: guard.status, headers });
  }

  try {
    const result = await buildSeed();
    return Response.json(result);
  } catch (error) {
    // 内部エラー詳細はクライアントへ返さずサーバーログに集約（エラー隠蔽・docs/design-notes.md §4-1）
    console.error('seed failed:', error);
    return Response.json({ error: 'Seed failed' }, { status: 500 });
  }
}
