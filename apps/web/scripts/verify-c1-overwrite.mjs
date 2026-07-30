#!/usr/bin/env node
/**
 * C-1 / C-1-b の最終判定：
 *   C-1   : 言い直しで**サイトが増えていない**（同じ siteId のまま中身が置き換わった）
 *   C-1-b : 他人のサイトIDを指定した上書きが拒否され、**そのサイトの中身が変わっていない**
 *
 * **このスクリプトはアプリのサーバーを停止したあとに、別プロセスとして走らせること。**
 * 画面が「置き換わりました」と言っていることと、保存先が実際にそうなっていることは別物で、
 * 稼働中プロセスのメモリを見せているだけでも画面は同じように見える。
 *
 * 停止をどう担保しているか（ここを取り違えると証拠が崩れる）:
 *   ワークフローで E2E とこの検証を**別ステップ＝別プロセス**に分け、Playwright の webServer が
 *   E2E 終了時に `pnpm start` を終了させる（playwright.c1.config.ts で CI は reuseExistingServer:false）。
 *   さらに実行前に到達性を確認し、まだ生きていれば落とす（c1-regenerate-smoke.yml）。
 *
 * ⚠ 「PGlite は単一プロセス専有だから、読めたこと自体が停止の証拠」というのは**誤り**
 *   （pglite 0.5.4 では稼働中でも別プロセスから同じ dataDir を開けることを独立検証者が実測済み。
 *   docs/failures.md 2026-07-28）。
 *
 * 入力は tests/e2e/authed-regenerate.spec.ts が書き出した .c1-result.json（画面で観測した事実）。
 * 落ちた理由は必ず1行で出す（CI ログが evidence の一部になる）。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PGlite } from '@electric-sql/pglite';

// このファイルが apps/web 配下に居るのは意図的。`@electric-sql/pglite` は apps/web の依存なので、
// pnpm の厳格な node_modules ではリポジトリ直下の scripts/ から import できない（verify-b2 と同じ理由）。
const WEB_DIR = path.join(import.meta.dirname, '..');
const RESULT_PATH = path.join(WEB_DIR, 'tests', 'e2e', '.c1-result.json');
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? path.join(WEB_DIR, '.pglite');

const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
}

async function main() {
  let observed;
  try {
    observed = JSON.parse(await readFile(RESULT_PATH, 'utf-8'));
  } catch (error) {
    console.error(
      `✗ 画面側の観測結果 (${RESULT_PATH}) が読めません。受入 E2E が最後まで走っていない可能性があります: ${error.message}`,
    );
    process.exit(1);
  }

  const { owner, attacker } = observed;
  const db = new PGlite(DATA_DIR);

  /** メールアドレスから、その人が所有するサイトを引く（所有＝organizations.created_by 一致）。 */
  async function ownedSites(email) {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.brief, s.theme, s.palette, s.motion, s.design
         FROM sites s
         JOIN organizations o ON o.id = s.organization_id
         JOIN users u ON u.id = o.created_by
        WHERE u.email = $1`,
      [email],
    );
    return rows;
  }

  /** そのサイトに保存されている全文言を1本の文字列に畳む（目印の有無を見るため）。 */
  async function storedTextOf(siteId) {
    const { rows } = await db.query(`SELECT value FROM content_entries WHERE site_id = $1`, [siteId]);
    return rows
      .map((row) => (typeof row.value === 'string' ? row.value : JSON.stringify(row.value)))
      .join('\n');
  }

  // ---- C-1：サイトが増えていないこと ----
  const ownerSites = await ownedSites(owner.email);
  check(
    ownerSites.length === 1,
    `C-1: 言い直しでサイトが増えている（所有者のサイトが ${ownerSites.length} 件。上書きなら1件のはず）`,
  );
  check(
    ownerSites.some((row) => row.id === owner.siteId),
    `C-1: 画面が紐付いていると言ったサイト ${owner.siteId} が、その人の所有として保存先に無い`,
  );

  const ownerSite = ownerSites.find((row) => row.id === owner.siteId);
  if (ownerSite) {
    // 依頼文と表示名が言い直し後のものになっていること（＝上書きが sites 行にも効いている）
    check(
      ownerSite.brief === owner.briefB,
      'C-1: 保存されている依頼文が言い直し後のものになっていない（sites 行が更新されていない）',
    );
    check(
      typeof ownerSite.name === 'string' && ownerSite.name.includes(owner.markerB),
      'C-1: 一覧の表示名が言い直し後の依頼文から作られていない',
    );
    // 見た目の一点物（templateId から引けない情報）が消えていないこと
    for (const column of ['theme', 'palette', 'motion']) {
      check(Boolean(ownerSite[column]), `C-1: 上書き後に site の ${column} が失われている`);
    }
    check(ownerSite.design != null, 'C-1: 上書き後に site の design が失われている');

    // 中身が実際に置き換わっていること（目印Bが在り、目印Aは無い）
    const ownerText = await storedTextOf(owner.siteId);
    check(
      ownerText.includes(owner.markerB),
      `C-1: 言い直し後の目印「${owner.markerB}」が保存先の文言に見当たらない（画面だけ変わって保存されていない）`,
    );
    check(
      !ownerText.includes(owner.markerA),
      `C-1: 言い直し前の目印「${owner.markerA}」が保存先に残っている（古いセクションが消えずに積まれている）`,
    );

    // ⚠ 空文字を先に弾く。''.includes('') は常に true なので、観測側の headline が空だと素通りする
    //   （verify-b2-persistence.mjs で独立検証者が実測した偽の緑の経路）。
    check(
      typeof owner.headline === 'string' && owner.headline.trim().length > 0,
      'C-1: 観測結果に見出しが無い（空だと同一性の照合が素通りする）',
    );
    check(
      owner.headline.trim().length > 0 && ownerText.includes(owner.headline),
      `C-1: 画面に出ていた見出し「${owner.headline}」が保存先の文言に見当たらない`,
    );

    // セクション構成が画面と一致し、文言が空のセクションが無いこと（骨組みだけの上書きを落とす）
    const { rows: sectionRows } = await db.query(
      `SELECT id, section_type FROM sections WHERE site_id = $1 ORDER BY "order" ASC`,
      [owner.siteId],
    );
    const storedTypes = sectionRows.map((row) => row.section_type);
    check(
      JSON.stringify(storedTypes) === JSON.stringify(owner.sectionTypes),
      `C-1: 上書き後のセクション構成が画面と違う（画面 ${JSON.stringify(owner.sectionTypes)} / 保存先 ${JSON.stringify(storedTypes)}）`,
    );

    const { rows: entryRows } = await db.query(
      `SELECT section_id, value FROM content_entries WHERE site_id = $1`,
      [owner.siteId],
    );
    const sectionIdsWithText = new Set(
      entryRows
        .filter((entry) => {
          const value = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value ?? '');
          return value.trim().length > 0;
        })
        .map((entry) => entry.section_id),
    );
    const emptySections = sectionRows.filter((row) => !sectionIdsWithText.has(row.id));
    check(
      sectionRows.length > 0 && emptySections.length === 0,
      `C-1: 上書き後に文言が1つも無いセクションが ${emptySections.length} 件ある（全 ${sectionRows.length} 件中）`,
    );

    // ページ（公開URLの宛先）が作り直されていないこと
    const { rows: pageRows } = await db.query(`SELECT id, slug FROM pages WHERE site_id = $1`, [owner.siteId]);
    check(
      pageRows.length === 1,
      `C-1: 上書きでページが増えている（${pageRows.length} 枚。公開URLの宛先が増えると配ったリンクが指す先が変わる）`,
    );
  }

  // ---- C-1-b：他人のサイトを上書きできていないこと ----
  check(
    attacker.rejectedStatus === 404,
    `C-1-b: 他人のサイトIDを指定した上書きが拒否されていない（観測 HTTP ${attacker.rejectedStatus}）`,
  );
  const attackerSites = await ownedSites(attacker.email);
  check(
    attackerSites.length === 0,
    `C-1-b: 拒否されたはずの攻撃者に ${attackerSites.length} 件のサイトが作られている（拒否後に新規作成へ落ちている）`,
  );
  const targetText = await storedTextOf(attacker.targetSiteId);
  check(
    !targetText.includes(attacker.markerC),
    `C-1-b: 攻撃者の目印「${attacker.markerC}」が被害者のサイトの文言に入っている（上書きされた）`,
  );
  check(
    targetText.includes(owner.markerB),
    `C-1-b: 被害者のサイトから正当な内容（目印「${owner.markerB}」）が失われている`,
  );

  await db.close();

  if (failures.length > 0) {
    console.error('✗ C-1 / C-1-b の検証に失敗しました:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(
    `✓ C-1: サーバー停止後の別プロセスから保存先を直接読み、言い直しがサイト ${owner.siteId} の上書きになっていること（サイト数1件・目印が入れ替わっている）を確認しました。`,
  );
  console.log(
    `✓ C-1-b: 他人のサイトIDを指定した上書きが HTTP ${attacker.rejectedStatus} で拒否され、被害者のサイトの中身が変わっていないことを確認しました。`,
  );
}

main().catch((error) => {
  console.error(`✗ 検証スクリプトが異常終了しました: ${error.stack ?? error.message}`);
  process.exit(1);
});
