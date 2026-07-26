import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { POST } from '../../app/api/eval/route';

/**
 * 収集口はローカル専用（STEP1）。本番で開いていると未認証の課金口になるため、
 * 404 で塞がっていることを機械で確かめる（既存 /api/generate と同じガード）。
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: unknown): Request {
  return new Request('http://localhost/api/eval', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/eval', () => {
  it('本番では 404（LLM を呼ばない）', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await POST(request({ limit: 1 }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('不正な入力は 400', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(request({ limit: 999 }));

    expect(response.status).toBe(400);
  });
});

describe('eval/briefs.json', () => {
  it('依頼文が 20 件あり、id と本文が重複していない', () => {
    const raw = readFileSync(path.join(process.cwd(), 'eval', 'briefs.json'), 'utf8');
    const parsed = JSON.parse(raw) as { briefs: Array<{ id: string; brief: string }> };

    expect(parsed.briefs.length).toBe(20);
    expect(new Set(parsed.briefs.map((entry) => entry.id)).size).toBe(20);
    expect(new Set(parsed.briefs.map((entry) => entry.brief)).size).toBe(20);
    expect(parsed.briefs.every((entry) => entry.brief.length >= 30)).toBe(true);
  });
});
