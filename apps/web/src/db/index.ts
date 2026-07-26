import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema';

const dataDir = process.env.PGLITE_DATA_DIR ?? './.pglite';
const databaseUrl = process.env.DATABASE_URL;

// PgliteDatabase / NodePgDatabase は共に PgDatabase<THKT, TFullSchema> を継承するが
// HKT（QueryResult型）がドライバごとに異なるため、共通利用側の型は `any` で吸収した
// PgDatabase<any, typeof schema> に統一する（drizzle公式の複数ドライバ対応パターン）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PgDatabase<any, typeof schema>;

// HMR/同一プロセスでの二重オープン防止のため globalThis にキャッシュする
const g = globalThis as unknown as { __pglite?: PGlite; __pgPool?: Pool; __db?: Database };

/**
 * DB接続を初回アクセス時に生成する遅延初期化。
 * トップレベルで `new PGlite()` / `new Pool()` を評価すると `next build` のページデータ収集フェーズで
 * 接続を多重オープンし、直後の e2e seed が 500 で壊れる（advisory A-1）。
 * import 時は副作用を持たず、実クエリ時に初めて接続する。
 *
 * `DATABASE_URL` が設定されていれば本番想定の Neon（node-postgres 経由）、
 * 未設定ならローカル PGlite に接続する（マスター確定: 本番DBはNeon・ローカル/テストはPGlite継続で層分離）。
 */
function getDb(): Database {
  if (!g.__db) {
    if (databaseUrl) {
      const pool = g.__pgPool ?? new Pool({ connectionString: databaseUrl });
      if (!g.__pgPool) g.__pgPool = pool;
      g.__db = drizzleNodePg(pool, { schema }) as unknown as Database;
    } else {
      const client = g.__pglite ?? new PGlite(dataDir);
      if (!g.__pglite) g.__pglite = client;
      g.__db = drizzlePglite(client, { schema }) as unknown as Database;
    }
  }
  return g.__db;
}

/**
 * 遅延初期化を呼び出し側へ透過させる Proxy。`db.select(...)` 等の記法を変えずに、
 * プロパティアクセス時点で初めて getDb() が走る。メソッドは実体へ bind し `this` を保つ。
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
