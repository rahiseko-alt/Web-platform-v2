/**
 * 認証済みユーザーが依頼文を送るとLPが生成される画面（ロードマップ B-1）。
 *
 * app/try との違いは「誰の口か」だけ:
 * - app/try         : 未認証のローカル開発口（本番では 404 で塞ぐ）
 * - ここ（/generate）: ログイン中のユーザーの実フロー。本番でも開く
 *
 * 生成手順そのものは持たない。単一経路 createPageFromBrief() の outcome を画面へ写すだけ
 * （手順の複製を作らない・ロードマップ F-4。tests/unit/generate-create-page.test.ts が構造ガード）。
 *
 * 認可の多層防御:
 *   middleware.ts の Cookie 存在チェックは optimistic check のため、ここで requireSession により
 *   実体のセッション有効性を再検証する（api-guard.ts と同じ思想）。未ログインは /login へ誘導する。
 *
 * 永続化（生成結果をそのユーザーの所有物として保存する）は B-2 の担当でここには含めない。
 * この葉が満たすのは「生成が実行され、結果が返る」ことだけ。
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import { requireSession } from '@/lib/api-guard';
import { createPageFromBrief } from '@/generate/create-page';

export const dynamic = 'force-dynamic';

/** 依頼文の最大長。app/api/generate の zod スキーマ（max 2000）と揃える。 */
const BRIEF_MAX_LENGTH = 2000;

/**
 * E2E / 独立検証が「生成結果が返った」ことを掴むための安定マーカー。
 * 画面文言は変わりうるので、判定はこの data 属性で行う（文言依存の脆い検証にしない）。
 */
const RESULT_MARKER = 'generated-page';

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function Shell({ brief, children }: { brief: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-surface px-6 py-4">
      <form method="GET" action="/generate" className="mx-auto flex max-w-3xl gap-3">
        <textarea
          name="brief"
          defaultValue={brief}
          rows={2}
          maxLength={BRIEF_MAX_LENGTH}
          placeholder="どんなサイトが欲しいか書いてください（生成に10〜20秒かかります）"
          className="flex-1 border border-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 self-start rounded-md bg-primary px-4 py-2 text-sm text-primary-contrast"
        >
          生成
        </button>
      </form>
      {children}
    </div>
  );
}

function Notice({ brief, children }: { brief: string; children: React.ReactNode }) {
  return (
    <>
      <Shell brief={brief} />
      <p data-generate-status="error" className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-600">
        {children}
      </p>
    </>
  );
}

export default async function GeneratePage({ searchParams }: { searchParams: Promise<Params> }) {
  const requestHeaders = await headers();
  // next/headers の ReadonlyHeaders は fetch API Headers から mutator を除いた型のため、
  // read-only 用途（getSession 内部の get 呼出のみ）に限定して安全にキャストする。
  const session = await requireSession(requestHeaders as unknown as Headers);
  if (!session.ok) {
    redirect('/login?redirect=%2Fgenerate');
  }

  const params = await searchParams;
  const brief = (one(params, 'brief') ?? '').trim().slice(0, BRIEF_MAX_LENGTH);

  if (!brief) {
    return (
      <>
        <Shell brief="" />
        <p data-generate-status="empty" className="mx-auto max-w-3xl px-6 py-10 text-sm text-text-muted">
          作りたいサイトの希望を入力して「生成」を押してください。
        </p>
      </>
    );
  }

  const outcome = await createPageFromBrief({ brief, useCache: true });

  if (outcome.status === 'no-api-key') {
    return <Notice brief={brief}>生成の準備ができていません（サーバー設定を確認してください）。</Notice>;
  }

  if (outcome.status === 'failed') {
    // 内部エラーの詳細はクライアントへ返さずサーバーログへ集約（docs/design-notes.md §4-1）
    return <Notice brief={brief}>生成に失敗しました。もう一度お試しください。</Notice>;
  }

  if (outcome.status === 'rejected') {
    return (
      <Notice brief={brief}>
        品質の基準を満たす結果が得られませんでした（{outcome.attempts}回試行）。依頼文を具体的にして再度お試しください。
      </Notice>
    );
  }

  const { page } = outcome;

  return (
    <>
      <Shell brief={brief}>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-text-muted">
          {outcome.fromCache ? '前回の生成結果を再表示しています' : `生成しました（${outcome.attempts}回で通過）`}
        </p>
      </Shell>
      <div data-generate-status="ok" data-generated-page={RESULT_MARKER}>
        <SiteThemeProvider theme={page.theme} palette={page.palette} motion={page.motion}>
          <PageRenderer sections={page.sections} design={page.design} />
        </SiteThemeProvider>
      </div>
    </>
  );
}
