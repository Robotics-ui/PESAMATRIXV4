import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("prt_token_idx").on(table.token),
  index("prt_user_id_idx").on(table.userId),
]);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
