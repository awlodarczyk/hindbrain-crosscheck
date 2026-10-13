import { primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ProviderId } from "./enums";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
    lastLoginAt: text("last_login_at"),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    ip: text("ip"),
    ua: text("ua"),
  },
  (t) => [uniqueIndex("auth_sessions_token_hash_uq").on(t.tokenHash)],
);

export const settings = sqliteTable("settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  json: text("json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const providerSecrets = sqliteTable(
  "provider_secrets",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<ProviderId>().notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);
