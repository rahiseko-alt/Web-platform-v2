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
 * 永続化（生成結果をそのユーザーの所有物として保存する）は B-2-a の担当。手順そのものは
 * src/db/queries/save-generated-page.ts が持ち、ここは「いつ呼ぶか」だけを決める:
 *   **実際に生成が走ったときだけ保存する（fromCache:false のときだけ）**。
 *   キャッシュ再表示でも保存すると、画面をリロードするたびに同じサイトが増殖する。
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import { requireSession } from '@/lib/api-guard';
import { createPageFromBrief } from '@/generate/create-page';
import { saveGeneratedPage } from '@/db/queries/save-generated-page';
import { scorePage } from '@/eval/score';
import { ScoreCard } from '@/eval/ScoreCard';

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

  // cacheScope にユーザーIDを渡す。渡さないと全利用者共有のキャッシュになり、
  // 別の人が同じ依頼文を出したときに他人の結果が返って保存もされない（cache.ts 参照）。
  const outcome = await createPageFromBrief({ brief, useCache: true, cacheScope: session.userId });

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

  // 機械採点（B-3）。稼働ループには置かず、保存済みの結果に対して後から回す既存方針
  // （docs/design-notes.md §6-1）どおり、ここでも生成が終わった outcome.page に対して行う。
  // fromCache でも計算する：scorePage は brief+page の純関数で、キャッシュ再表示でも
  // 同じ入力からは同じ点が出るため、キャッシュかどうかで表示するかを分けない。
  const score = scorePage(brief, page);

  // 保存（B-2-a）。実際に生成が走ったときだけ書く＝リロード（キャッシュ再表示）で増殖させない。
  // 保存の失敗は握りつぶさない：保存できていないのに「できました」の画面を見せると、
  // 一覧に出ない理由が利用者にも検証者にも分からなくなる。
  let savedSiteId: string | null = null;
  if (!outcome.fromCache) {
    try {
      const saved = await saveGeneratedPage({ userId: session.userId, brief, page });
      savedSiteId = saved.siteId;
    } catch (error) {
      console.error('generate: failed to persist generated page:', error);
      return <Notice brief={brief}>生成はできましたが、保存に失敗しました。もう一度お試しください。</Notice>;
    }
  }

  return (
    <>
      <Shell brief={brief}>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-text-muted">
          {outcome.fromCache ? '前回の生成結果を再表示しています' : `生成しました（${outcome.attempts}回で通過）`}
          {' / '}
          <Link href="/editor" className="text-accent underline">
            自分のサイト一覧
          </Link>
        </p>
      </Shell>
      {/*
        data-generate-from-cache: この結果が LLM 由来か、キャッシュの再表示かを外から判別できるようにする。
        受入検証（B-1）は「実際に生成が走った」ことを要求するので "false" を要求できる必要がある。
        これが無いと、将来キャッシュが永続化されたときに LLM 未呼び出しでも緑になりうる。
      */}
      {/*
        data-saved-site-id: 保存された実体（B-2-a）を外から掴むための安定マーカー。
        画面が出ていることと保存されたことは別なので、独立検証はこのIDでDBを直接引く。
        キャッシュ再表示のときは保存していないので付かない（undefined = 属性ごと出ない）。
      */}
      <div
        data-generate-status="ok"
        data-generated-page={RESULT_MARKER}
        data-generate-from-cache={String(outcome.fromCache)}
        data-saved-site-id={savedSiteId ?? undefined}
      >
        <SiteThemeProvider theme={page.theme} palette={page.palette} motion={page.motion}>
          <PageRenderer sections={page.sections} design={page.design} />
        </SiteThemeProvider>
      </div>
      <ScoreCard score={score} />
    </>
  );
}
