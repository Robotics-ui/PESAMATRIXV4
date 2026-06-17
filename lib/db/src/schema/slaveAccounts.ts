import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const slaveAccountsTable = pgTable("slave_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  metaapiAccountId: text("metaapi_account_id"),
  subscriberId: text("subscriber_id"),
  mt5Login: text("mt5_login").notNull(),
  broker: text("broker").notNull(),
  server: text("server").notNull(),
  investorPasswordEncrypted: text("investor_password_encrypted").notNull(),
  status: text("status").notNull().default("connecting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSlaveAccountSchema = createInsertSchema(slaveAccountsTable).omit({ id: true, createdAt: true });
export type InsertSlaveAccount = z.infer<typeof insertSlaveAccountSchema>;
export type SlaveAccount = typeof slaveAccountsTable.$inferSelect;
