#!/usr/bin/env node
// ソースコードが引用する設計根拠ドキュメントの実在検査（リンク切れの機械検出）。
//
// なぜ必要か（ロードマップ F-1）:
//   コードのコメントは「なぜこの実装なのか」の根拠を別ファイルへ委ねることがある。
//   その参照先が存在しないと、後から「この変更は根拠に準拠しているか」を検証できず、
//   根拠を無視した変更が積み上がる。実際 2026-07-27 時点で、前リポジトリからコードのみ
//   移送された結果、23 ファイルが実在しない .md を準拠元として引用していた
//   （git 全履歴を探しても一度も存在しない＝復元不可）。
//   人手のレビューでは見落とすため、機械で毎回検出する。
//
// 検査対象: apps/ packages/ scripts/ 配下のソース（.ts/.tsx/.js/.jsx/.mjs/.cjs）。
//   Markdown 同士の相互参照は対象外（「旧◯◯は廃止」のように“存在しないこと”を正当に述べる
//   記述が含まれ、機械が誤検出するため）。
//
// このスクリプト自身も検査対象に含む（自己除外しない）。そのため以下のコメントでは
// 実在しないファイル名を例示として書かない。書くと自分自身が赤くなる＝規律が自分にも効く。
//
// 判定: コメント/文字列中の `....md` を全て拾い、リポジトリ内に実在しなければ exit 1。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

/** 参照元として走査するディレクトリ */
const SCAN_DIRS = ["apps", "packages", "scripts"];
/** 参照元として走査する拡張子 */
const SCAN_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
/** 走査から除外するディレクトリ名 */
const SKIP_DIRS = new Set(["node_modules", ".next", ".pglite", "dist", ".git", ".turbo"]);

/** 拡張子 .md のファイル参照を拾う（素のファイル名／パス付き／@ エイリアス始まりのいずれも）。
 *  日本語に隣接していても切り出せるよう、区切り文字に依存せず文字クラスで抜く */
const MD_REF = /[A-Za-z0-9_@][A-Za-z0-9_@./-]*\.md/g;

function walkFiles(dir, onFile) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // 存在しないディレクトリは黙って飛ばす（packages/ が消えても壊れない）
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, onFile);
    else onFile(full);
  }
}

/** リポジトリ内の全 .md を「相対パス集合」と「ベース名 -> 相対パス[]」で索引する */
function indexMarkdownFiles() {
  const byPath = new Set();
  const byBase = new Map();
  walkFiles(repoRoot, (full) => {
    if (!full.endsWith(".md")) return;
    const rel = relative(repoRoot, full);
    byPath.add(rel);
    const base = basename(rel);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(rel);
  });
  return { byPath, byBase };
}

/** 参照が実在するか。パス付きは位置も含めて、素のファイル名はベース名一致で解決する */
function resolves(ref, fromFile, index) {
  const cleaned = ref.replace(/^@\//, "apps/web/src/");
  if (index.byPath.has(cleaned)) return true;
  // 参照元ファイルからの相対参照
  const fromDir = dirname(relative(repoRoot, fromFile));
  const relResolved = relative(repoRoot, resolve(repoRoot, fromDir, cleaned));
  if (index.byPath.has(relResolved)) return true;
  // パス無しの素のファイル名は、リポジトリ内の同名ファイルで解決する
  if (!cleaned.includes("/")) return index.byBase.has(cleaned);
  return false;
}

function main() {
  const index = indexMarkdownFiles();
  const violations = [];
  let scanned = 0;
  let refs = 0;

  for (const dir of SCAN_DIRS) {
    walkFiles(join(repoRoot, dir), (full) => {
      if (!SCAN_EXTS.some((ext) => full.endsWith(ext))) return;
      scanned++;
      const lines = readFileSync(full, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const m of line.matchAll(MD_REF)) {
          refs++;
          const ref = m[0];
          if (resolves(ref, full, index)) continue;
          violations.push(
            `${relative(repoRoot, full)}:${i + 1}: "${ref}" は実在しません（参照先が無い＝根拠に辿り着けない）`,
          );
        }
      });
    });
  }

  if (violations.length > 0) {
    console.error("✗ doc-refs リンタ: 実在しないドキュメント参照を検出");
    for (const v of violations) console.error("  - " + v);
    console.error(
      "\n  対処: 参照先を実在するドキュメントへ張り替えるか、根拠をコメント内に直接書くこと。",
    );
    process.exit(1);
  }

  console.log(
    `✓ doc-refs リンタ: OK（ソース ${scanned} ファイル / ドキュメント参照 ${refs} 件、リンク切れなし）`,
  );
}

main();
