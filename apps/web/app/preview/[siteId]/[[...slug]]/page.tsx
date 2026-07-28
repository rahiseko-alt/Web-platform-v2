import { notFound } from 'next/navigation';
import { getRenderablePage } from '@/db/queries/site-render';
import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import { getDesignSpec } from '@/templates/registry';

export const dynamic = 'force-dynamic';

/**
 * プレビュー用動的ルート。DB→レンダリングパイプラインの一気通貫確認に使う（即死仮説#1検証コア）。
 * optional catch-all slug: 未指定・空配列は '/'（ホーム）、それ以外は '/' join。
 */
export default async function Page({
  params,
}: {
  params: Promise<{ siteId: string; slug?: string[] }>;
}) {
  const { siteId, slug } = await params;
  const slugStr = !slug || slug.length === 0 ? '/' : slug.join('/');

  const data = await getRenderablePage(siteId, slugStr);
  if (!data) notFound();

  // sectionスコープの accentColor 編集（仮説#3）をsite全体へ反映するための簡易ヒューリスティック:
  // ページ内で最初に見つかった accentColor をそのまま --site-accent へ渡す。
  // サイト全体テーマ編集（site単位の永続設定）は本フェーズのスコープ外（plan Step2 注意点参照）。
  const accentColor = data.sections
    .map((s) => s.content.accentColor)
    .find((v): v is string => typeof v === 'string');

  // 構造化トークン（DesignSpec）の出どころは2系統ある:
  // - 生成されたサイト（B-2-a）: templateId を持たない一点物なので sites.design に保存済み。それを使う。
  // - テンプレ由来のサイト     : templateId 起点で registry から引く（未登録は undefined ＝ 既定変種）。
  // 生成サイトで registry を引くと必ず undefined になり、保存したLPが既定変種の別物として出る。
  const design = data.site.design ?? getDesignSpec(data.site.templateId);

  return (
    <SiteThemeProvider
      theme={data.site.theme}
      accentColor={accentColor}
      palette={data.site.palette ?? undefined}
      motion={data.site.motion ?? undefined}
    >
      <PageRenderer sections={data.sections} design={design} />
    </SiteThemeProvider>
  );
}
