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
 *
 * 言い直しによる上書き再生成（ロードマップ C-1）:
 *   1度生成すると、このフォームは直前に保存した siteId を hidden field で持ち回る。
 *   siteId が付いた送信は**新しいサイトを作らず、そのサイトの中身を入れ替える**
 *   （マスター決定。理由は roadmap の C-1 detail が正）。
 *
 *   hidden field はクライアントが自由に書き換えられるので、siteId が付いている送信は
 *   **生成を始める前に** requireSiteOwnership で所有権を再検証する（ロードマップ C-1-b）。
 *   生成の前に置くのは、他人のサイトを狙った送信で LLM 課金を発生させないため。
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import { requireSession, requireSiteOwnership } from '@/lib/api-guard';
import { createPageFromBrief } from '@/generate/create-page';
import { saveGeneratedPage, updateGeneratedPage } from '@/db/queries/save-generated-page';
import { scorePage } from '@/eval/score';
import { ScoreCard } from '@/eval/ScoreCard';

export const dynamic = 'force-dynamic';

const siteIdParamSchema = z.string().uuid();

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

/**
 * 依頼文の入力欄と送信ボタン。
 *
 * `siteId` を渡すと hidden field として持ち回す＝次の送信が「そのサイトの言い直し」になる（C-1）。
 * 空のときは field ごと出さない: `siteId=` という空の値が URL に付くと、
 * 「指定あり・ただし不正な値」と見分けが付かなくなる。
 */
function Shell({
  brief,
  siteId,
  children,
}: {
  brief: string;
  siteId?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface px-6 py-4">
      <form method="GET" action="/generate" className="mx-auto flex max-w-3xl gap-3">
        {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
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

function Notice({
  brief,
  siteId,
  children,
}: {
  brief: string;
  siteId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <Shell brief={brief} siteId={siteId} />
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

  /*
    言い直しの宛先（C-1）。**生成より前に**所有権を検証する（C-1-b）。
    不正な形の値・他人のサイト・存在しないサイトは、editor/[siteId]/page.tsx と同じく
    notFound() へ丸める（401/403/404 を画面では区別しない＝エラー隠蔽・docs/design-notes.md §4-1）。
    ここで弾けば、攻撃的な送信で LLM 課金が発生することも無い。
  */
  const rawSiteId = (one(params, 'siteId') ?? '').trim();
  let ownership: { userId: string; organizationId: string; siteId: string } | null = null;
  if (rawSiteId !== '') {
    const parsed = siteIdParamSchema.safeParse(rawSiteId);
    if (!parsed.success) {
      notFound();
    }
    const guard = await requireSiteOwnership(parsed.data, requestHeaders as unknown as Headers);
    if (!guard.ok) {
      notFound();
    }
    ownership = { userId: guard.userId, organizationId: guard.organizationId, siteId: guard.siteId };
  }

  if (!brief) {
    return (
      <>
        <Shell brief="" siteId={ownership?.siteId} />
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
    return (
      <Notice brief={brief} siteId={ownership?.siteId}>
        生成の準備ができていません（サーバー設定を確認してください）。
      </Notice>
    );
  }

  if (outcome.status === 'failed') {
    // 内部エラーの詳細はクライアントへ返さずサーバーログへ集約（docs/design-notes.md §4-1）
    return (
      <Notice brief={brief} siteId={ownership?.siteId}>
        生成に失敗しました。もう一度お試しください。
      </Notice>
    );
  }

  if (outcome.status === 'rejected') {
    return (
      <Notice brief={brief} siteId={ownership?.siteId}>
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

  /*
    保存（B-2-a）と上書き（C-1）。実際に生成が走ったときだけ書く＝リロード（キャッシュ再表示）で
    増殖させない。保存の失敗は握りつぶさない：保存できていないのに「できました」の画面を見せると、
    一覧に出ない理由が利用者にも検証者にも分からなくなる。

    キャッシュ再表示のときも siteId は持ち回す（savedSiteId の初期値が ownership の siteId）。
    ここで落とすと、同じ依頼文で再送信した次の1回だけ紐付きが切れ、そのあとの言い直しが
    上書きではなく新規作成になってしまう。
  */
  let savedSiteId: string | null = ownership?.siteId ?? null;
  if (!outcome.fromCache) {
    try {
      const written = ownership
        ? await updateGeneratedPage({ ownership, brief, page })
        : await saveGeneratedPage({ userId: session.userId, brief, page });
      savedSiteId = written.siteId;
    } catch (error) {
      console.error('generate: failed to persist generated page:', error);
      return (
        <Notice brief={brief} siteId={ownership?.siteId}>
          生成はできましたが、保存に失敗しました。もう一度お試しください。
        </Notice>
      );
    }
  }

  return (
    <>
      <Shell brief={brief} siteId={savedSiteId}>
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
