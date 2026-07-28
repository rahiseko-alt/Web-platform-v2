/**
 * 自分のサイト一覧（ロードマップ B-2-b / B-2-c）。
 *
 * ここはログイン成功後の着地点でもある（app/(auth)/login/page.tsx が `/editor` へ push する）。
 * これまで app/editor/ には [siteId]/ しか無く、ログイン直後に実測で404になっていた
 * （A-2 の独立検証で観測）。その穴をここで塞ぐ。
 *
 * 認可の多層防御:
 *   middleware.ts の Cookie 存在チェックは optimistic check のため、ここで requireSession により
 *   実体のセッション有効性を再検証する（api-guard.ts と同じ思想）。
 *
 * 他人のサイトを出さない責任は listSitesForUser() 側にある（siteId が未確定なこの経路では
 * requireSiteOwnership が使えないため）。ここは userId を渡すだけで、絞り込みを自前で書かない
 * ＝絞り込みの実装が2箇所へ散らない。
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireSession } from '@/lib/api-guard';
import { listSitesForUser } from '@/db/queries/user-sites';

export const dynamic = 'force-dynamic';

/** E2E / 独立検証が一覧を掴むための安定マーカー（画面文言に依存した脆い検証にしない）。 */
const LIST_MARKER = 'site-list';

export default async function SiteListPage() {
  const requestHeaders = await headers();
  // next/headers の ReadonlyHeaders は fetch API Headers から mutator を除いた型のため、
  // read-only 用途（getSession 内部の get 呼出のみ）に限定して安全にキャストする。
  const session = await requireSession(requestHeaders as unknown as Headers);
  if (!session.ok) {
    redirect('/login?redirect=%2Feditor');
  }

  const userSites = await listSitesForUser(session.userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-heading text-xl font-bold text-text">自分のサイト</h1>
        <Link href="/generate" className="text-sm text-accent underline">
          新しく作る
        </Link>
      </div>

      {/*
        data-site-count: 一覧が「空」なのか「壊れて何も出ていない」のかを外から区別できるようにする。
        これが無いと、常に空を返す実装でも B-2-c（他人のサイトが出ない）が緑になったまま、
        B-2-b の対照が取れない。
      */}
      <ul data-site-list={LIST_MARKER} data-site-count={userSites.length} className="mt-6 space-y-3">
        {userSites.map((site) => (
          <li key={site.id} data-site-id={site.id} className="border border-border p-4">
            <Link href={`/editor/${site.id}`} className="font-medium text-accent underline">
              {site.name}
            </Link>
            {site.brief && <p className="mt-1 text-sm text-text-muted">{site.brief}</p>}
            <p className="mt-2 text-xs text-text-muted">
              <a href={`/preview/${site.id}`} target="_blank" rel="noreferrer" className="underline">
                プレビューを開く
              </a>
            </p>
          </li>
        ))}
      </ul>

      {userSites.length === 0 && (
        <p className="mt-6 text-sm text-text-muted">
          まだサイトがありません。「新しく作る」から、どんなサイトが欲しいか書いてみてください。
        </p>
      )}
    </main>
  );
}
