import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const masterAccountAuditLogsTable = pgTable("master_account_audit_logs", {
  id: serial("id").primaryKey(),
  masterAccountId: integer("master_account_id").notNull(),
  userId: integer("user_id").notNull(),
  adminId: integer("admin_id"),
  event: text("event").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("master_audit_master_id_idx").on(table.masterAccountId),
  index("master_audit_created_at_idx").on(table.createdAt),
]);

export type MasterAccountAuditLog = typeof masterAccountAuditLogsTable.$inferSelect;
