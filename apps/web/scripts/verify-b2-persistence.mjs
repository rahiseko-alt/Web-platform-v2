#!/usr/bin/env node
/**
 * B-2-a の判定：作ったLPの中身が、その人のものとして保存先に残っているか。
 *
 * **このスクリプトはアプリのサーバーを停止したあとに、別プロセスとして走らせること。**
 * 画面が出ていることと保存されたことは別物で、稼働中プロセスのメモリを見せているだけでも
 * 画面は同じように見える。ローカル/CI の保存先は PGlite ＝ 単一プロセス専有なので、
 * 稼働中サーバーと同時に横から読むことはできない（docs/verification/A-4-idor-reject.md で実測済み）。
 * 逆に言えば「読めた」こと自体が、サーバーが落ちてもデータが残っている証拠になる。
 *
 * 入力は tests/e2e/authed-persist.spec.ts が書き出した .b2-result.json（画面で観測した事実）。
 * ここではそれと保存先の中身を突き合わせる。落ちた理由は必ず1行で出す（CI ログが evidence の一部になる）。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PGlite } from '@electric-sql/pglite';

// このファイルが apps/web 配下に居るのは意図的。`@electric-sql/pglite` は apps/web の依存なので、
// pnpm の厳格な node_modules ではリポジトリ直下の scripts/ から import できない（実測で ERR_MODULE_NOT_FOUND）。
const WEB_DIR = path.join(import.meta.dirname, '..');
const RESULT_PATH = path.join(WEB_DIR, 'tests', 'e2e', '.b2-result.json');
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

  const db = new PGlite(DATA_DIR);

  /** メールアドレスから、その人が所有するサイトを全部引く（所有＝organizations.created_by 一致）。 */
  async function ownedSites(email) {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.theme, s.palette, s.motion, s.design, s.brief, u.id AS user_id
         FROM sites s
         JOIN organizations o ON o.id = s.organization_id
         JOIN users u ON u.id = o.created_by
        WHERE u.email = $1`,
      [email],
    );
    return rows;
  }

  for (const [label, actor] of Object.entries(observed)) {
    const owned = await ownedSites(actor.email);
    const ownedIds = owned.map((row) => row.id);

    check(
      owned.length === actor.sites.length,
      `${label}: 保存されているサイト数が画面と合わない（画面 ${actor.sites.length} 件 / 保存先 ${owned.length} 件）`,
    );

    for (const site of actor.sites) {
      // (2) 所有者がその生成をした本人であること
      check(
        ownedIds.includes(site.siteId),
        `${label}: 画面が保存したと言った site ${site.siteId} が、その人の所有として保存先に無い`,
      );

      const row = owned.find((candidate) => candidate.id === site.siteId);
      if (!row) continue;

      // 見た目の設定（テンプレIDから引けない一点物）まで残っていること
      check(Boolean(row.theme), `${label}: site ${site.siteId} の theme が保存されていない`);
      check(Boolean(row.palette), `${label}: site ${site.siteId} の palette が保存されていない`);
      check(Boolean(row.motion), `${label}: site ${site.siteId} の motion が保存されていない`);
      check(row.design != null, `${label}: site ${site.siteId} の design が保存されていない`);
      check(
        row.brief === site.brief,
        `${label}: site ${site.siteId} に保存された依頼文が、送った依頼文と違う`,
      );

      // セクションが画面と同じ種類・同じ並びで残っていること
      const { rows: sectionRows } = await db.query(
        `SELECT section_type FROM sections WHERE site_id = $1 ORDER BY "order" ASC`,
        [site.siteId],
      );
      const storedTypes = sectionRows.map((s) => s.section_type);
      check(
        JSON.stringify(storedTypes) === JSON.stringify(site.sectionTypes),
        `${label}: site ${site.siteId} のセクション構成が画面と違う（画面 ${JSON.stringify(site.sectionTypes)} / 保存先 ${JSON.stringify(storedTypes)}）`,
      );

      // (1) 同一性の照合：画面に出ていた見出しの文言が、保存された文言の中に実在すること。
      // 骨組みだけの空の行や、たまたま別のサイトが1件ある状態では通らない。
      const { rows: entryRows } = await db.query(
        `SELECT value FROM content_entries WHERE site_id = $1`,
        [site.siteId],
      );
      const storedTexts = entryRows
        .map((entry) => (typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)))
        .join('\n');
      check(
        storedTexts.includes(site.headline),
        `${label}: site ${site.siteId} で画面に出ていた見出し「${site.headline}」が保存先の文言に見当たらない`,
      );
    }
  }

  // (3) 「他人が同じ依頼文を先に出していると保存されない」実装を落とす。
  // spec は B に A と同じ依頼文を使わせている。B の分がここまでで1件も見つからなければ上で落ちている。
  const aBriefs = new Set(observed.userA.sites.map((site) => site.brief));
  const bReused = observed.userB.sites.filter((site) => aBriefs.has(site.brief));
  check(
    bReused.length > 0,
    '受入の前提が崩れている：BがAと同じ依頼文で生成した記録が観測結果に無い（spec を確認すること）',
  );

  await db.close();

  if (failures.length > 0) {
    console.error('✗ B-2-a 保存の検証に失敗しました:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  const total = Object.values(observed).reduce((sum, actor) => sum + actor.sites.length, 0);
  console.log(
    `✓ B-2-a: サーバー停止後の別プロセスから保存先を直接読み、${total} 件のサイトが所有者つきで中身ごと残っていることを確認しました。`,
  );
}

main().catch((error) => {
  console.error(`✗ 検証スクリプトが異常終了しました: ${error.stack ?? error.message}`);
  process.exit(1);
});
