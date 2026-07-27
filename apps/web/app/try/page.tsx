/**
 * 依頼文を入れて生成結果のLPをその場で見る画面（マスター試用口・STEP1 ローカル確認）。
 *
 * サーバーコンポーネント＋素の GET フォームで完結させる（クライアント JS 不要）。
 * 生成は 10〜20 秒かかるので、送信後はそのまま待つ。
 *
 * 要素値の差し替え（theme/hero/rhythm/align/変種）は **LLM を呼び直さない**。
 * 依頼文をキーにキャッシュした生成結果を、機械が組み立て直すだけ（課金ゼロ・即時）。
 *
 * API route と同様、本番（STEP2 cloud）では塞ぐ。ここは開発用の口。
 */

import { notFound } from 'next/navigation';
import { PageRenderer } from '@/render/PageRenderer';
import { SiteThemeProvider } from '@/render/SiteThemeProvider';
import { createPageFromBrief } from '@/generate/create-page';
import { applyOverrides, type DesignOverrides } from '@/generate/overrides';
import { DesignControls } from './DesignControls';

export const dynamic = 'force-dynamic';

const SAMPLES: Array<{ label: string; brief: string }> = [
  {
    label: 'ネイルサロン',
    brief:
      '渋谷で新しくオープンする、女性向けの隠れ家的なネイルサロンのサイト。落ち着いた大人っぽい雰囲気で、料金メニューと予約をしっかり見せたい。',
  },
  {
    label: '老舗料亭',
    brief:
      '創業120年の老舗料亭のサイト。派手に、格式と華やかさを前面に出したい。接待利用の個室と会席コースを見せたい。',
  },
  {
    label: '無人ジム',
    brief: '24時間営業の無人ジム。とにかく安さと入会のしやすさを押し出したい。料金プランを3つ見せる。',
  },
];

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** チェックボックス群のように同名で複数返るクエリを配列で受ける */
function many(params: Params, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** `sv.services-01=editorial-index` 形式のクエリを差し替え指定として拾う */
function overridesFrom(params: Params): DesignOverrides {
  const sectionVariants: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith('sv.')) continue;
    const picked = Array.isArray(value) ? value[0] : value;
    if (picked) sectionVariants[key.slice(3)] = picked;
  }
  return {
    theme: one(params, 'theme'),
    palette: one(params, 'palette'),
    motion: one(params, 'motion'),
    // fxset があれば「人が明示した」＝1つもチェックが無い（＝全部外す）も指定として扱う
    motionEffects: one(params, 'fxset') ? many(params, 'fx') : undefined,
    heroVariant: one(params, 'heroVariant'),
    rhythm: one(params, 'rhythm'),
    align: one(params, 'align'),
    sectionVariants,
    cardStyle: one(params, 'cardStyle'),
    buttonShape: one(params, 'buttonShape'),
  };
}

/**
 * 上部バー。**既定では畳んである**（2026-07-24 マスター指摘「バーが大きすぎてLP本体が見えにくい」）。
 * 開いた状態は panel=1 で URL に持たせるので、差し替え後も開いたままになる。
 */
function Bar({ brief, panelOpen, children }: { brief: string; panelOpen: boolean; children?: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#111',
        color: '#fff',
        padding: '8px 16px',
        fontFamily: 'system-ui, sans-serif',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <form method="GET" action="/try" style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <input type="hidden" name="panel" value={panelOpen ? '1' : ''} />
        <textarea
          name="brief"
          defaultValue={brief}
          rows={1}
          placeholder="依頼文を入れて「生成」を押す（10〜20秒かかります）"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #444', background: '#1b1b1b', color: '#fff', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button type="submit" style={{ padding: '10px 20px', borderRadius: 6, border: 0, background: '#fff', color: '#111', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          生成
        </button>
      </form>

      <details open={panelOpen} style={{ maxWidth: 1100, margin: '6px auto 0' }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#7db6ff', listStyle: 'revert' }}>
          調整パネル（開閉）
        </summary>

        <div style={{ fontSize: 12, color: '#aaa', margin: '8px 0 0' }}>
          例:{' '}
          {SAMPLES.map((s) => (
            <a key={s.label} href={`/try?brief=${encodeURIComponent(s.brief)}&panel=1`} style={{ color: '#7db6ff', marginRight: 12 }}>
              {s.label}
            </a>
          ))}
        </div>
        {children}
      </details>
    </div>
  );
}

function Message({ brief, color, children }: { brief: string; color: string; children: React.ReactNode }) {
  return (
    <>
      <Bar brief={brief} panelOpen={false} />
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', color }}>{children}</div>
    </>
  );
}

export default async function TryPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const params = await searchParams;
  const brief = (one(params, 'brief') ?? '').trim().slice(0, 2000);

  if (!brief) {
    return (
      <Message brief="" color="#666">
        依頼文を入れるか、上の例を押してください。
      </Message>
    );
  }

  // 生成手順は単一経路 createPageFromBrief() に集約されている（ロードマップ F-4）。
  // ここは outcome を画面へ写すだけで、手順そのものは持たない。
  const outcome = await createPageFromBrief({ brief, useCache: true });

  if (outcome.status === 'no-api-key') {
    return (
      <Message brief={brief} color="#c00">
        OPENAI_API_KEY が未設定です（.env に置いてください）
      </Message>
    );
  }

  if (outcome.status === 'failed') {
    return (
      <Message brief={brief} color="#c00">
        生成に失敗しました（詳細はサーバーログ）
      </Message>
    );
  }

  if (outcome.status === 'rejected') {
    return (
      <Message brief={brief} color="#c00">
        <h2>機械ゲートが {outcome.attempts} 回とも拒否しました</h2>
        <ul>
          {outcome.rejections.map((r, i) => (
            <li key={i}>
              <code>{r.path}</code>: {r.reason}
            </li>
          ))}
        </ul>
      </Message>
    );
  }

  const { page, motionEffects, ignored } = applyOverrides(outcome.page, overridesFrom(params));

  return (
    <>
      <Bar brief={brief} panelOpen={one(params, 'panel') === '1'}>
        <div style={{ maxWidth: 1100, margin: '8px auto 0', fontSize: 12, color: '#ddd', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>{outcome.fromCache ? 'キャッシュから再組み立て（LLM不使用）' : `LLM生成 ${outcome.attempts}回で通過`}</span>
          <span style={{ color: '#9ad' }}>効いている動き: {motionEffects.length > 0 ? motionEffects.join(' / ') : 'なし（静止）'}</span>
          {page.needsReview && <span style={{ color: '#ffd479' }}>要確認: {page.unknowns.join(' / ')}</span>}
        </div>
        <DesignControls brief={brief} page={page} motionEffects={motionEffects} ignored={ignored} />
      </Bar>
      <SiteThemeProvider theme={page.theme} palette={page.palette} motion={page.motion} motionEffects={motionEffects}>
        <PageRenderer sections={page.sections} design={page.design} />
      </SiteThemeProvider>
    </>
  );
}
