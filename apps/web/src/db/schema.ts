import { pgTable, uuid, text, timestamp, integer, jsonb, unique, boolean } from 'drizzle-orm/pg-core';

/**
 * データモデル階層（docs/design-notes.md §1 準拠）
 * users -> organizations -> sites -> pages -> sections -> content_entries
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Better Auth 必須フィールド（`npx @better-auth/cli generate` 出力を既存 users テーブルへ統合。
  // id は既存の uuid defaultRandom() を維持し、Better Auth 側は
  // advanced.database.generateId: false でDB発行のIDに委ねる — src/auth/index.ts 参照）
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 以下 Better Auth 必須テーブル（session/account/verification）。
 * `npx @better-auth/cli generate`（provider: pg, config: src/auth/index.ts）の出力をベースに、
 * 既存スキーマの命名規約（uuid PK・複数形テーブル名）へ合わせて調整した。
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  templateId: text('template_id').notNull(),
  theme: text('theme').notNull(),
  status: text('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  /**
   * 以下4列は「生成されたサイト」（ロードマップ B-2）用。テンプレ由来のサイトでは null のまま。
   *
   * なぜ必要か: テンプレ由来のサイトは design/palette/motion を templateId から
   * `getDesignSpec()` で引けるが、生成されたサイトは templateId を持たない（LLM が
   * その場で決めた一点物）。ここへ書かないと、保存できるのは文言だけになり
   * 「保存したLPを開くと別物になる」＝ B-2 の『そのLPが残る』が成り立たない。
   */
  /** 配色軸（GeneratedPage.palette）。theme とは独立に色だけを決める */
  palette: text('palette'),
  /** 動き軸（GeneratedPage.motion） */
  motion: text('motion'),
  /** 構造化デザイントークン（DesignSpec）。テンプレの design と同じ形 */
  design: jsonb('design'),
  /** このサイトを生んだ依頼文。一覧で「何を頼んで作ったサイトか」を示すために持つ */
  brief: text('brief'),
});

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  slug: text('slug').notNull(),
  status: text('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('pages_site_slug_unique').on(table.siteId, table.slug),
]);

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  pageId: uuid('page_id').notNull().references(() => pages.id),
  sectionType: text('section_type').notNull(),
  order: integer('order').notNull(),
  status: text('status').notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('sections_page_order_unique').on(table.pageId, table.order),
]);

export const contentEntries = pgTable('content_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  sectionId: uuid('section_id').notNull().references(() => sections.id),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('content_entries_section_key_unique').on(table.sectionId, table.key),
]);
