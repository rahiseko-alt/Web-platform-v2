import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

/**
 * DATABASE_URL の有無で本番(Neon/標準postgres)とローカル(PGlite)を分岐する。
 * マスター確定: 本番DBはNeon・ローカル/テストはPGlite継続（層分離。src/db/index.ts と同じ分岐条件）。
 */
const config: Config = databaseUrl
  ? {
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'postgresql',
      dbCredentials: { url: databaseUrl },
    }
  : {
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'postgresql',
      driver: 'pglite',
      dbCredentials: { url: process.env.PGLITE_DATA_DIR ?? './.pglite' },
    };

export default config;
