import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const masterAccountsTable = pgTable("master_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  metaapiAccountId: text("metaapi_account_id"),
  platform: text("platform").notNull().default("mt5"),
  mt5Login: text("mt5_login").notNull(),
  broker: text("broker").notNull(),
  server: text("server").notNull(),
  investorPasswordEncrypted: text("investor_password_encrypted").notNull(),
  status: text("status").notNull().default("pending_approval"),
  deploymentStatus: text("deployment_status"),
  connectionStatus: text("connection_status"),
  rejectionReason: text("rejection_reason"),
  synchronizationStatus: text("synchronization_status"),
  lastErrorMessage: text("last_error_message"),
  metaapiRegion: text("metaapi_region"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("master_accounts_user_id_idx").on(table.userId),
  index("master_accounts_status_idx").on(table.status),
  index("master_accounts_metaapi_account_id_idx").on(table.metaapiAccountId),
]);

export const insertMasterAccountSchema = createInsertSchema(masterAccountsTable).omit({ id: true, createdAt: true });
export type InsertMasterAccount = z.infer<typeof insertMasterAccountSchema>;
export type MasterAccount = typeof masterAccountsTable.$inferSelect;
