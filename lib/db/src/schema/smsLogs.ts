import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smsLogsTable = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id"),
  userId: integer("user_id"),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  providerResponse: text("provider_response"),
  deliveryStatus: text("delivery_status"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sms_logs_status_idx").on(table.status),
  index("sms_logs_user_id_idx").on(table.userId),
  index("sms_logs_event_type_idx").on(table.eventType),
  index("sms_logs_created_at_idx").on(table.createdAt),
]);

export const insertSmsLogSchema = createInsertSchema(smsLogsTable).omit({ id: true, createdAt: true });
export type InsertSmsLog = z.infer<typeof insertSmsLogSchema>;
export type SmsLog = typeof smsLogsTable.$inferSelect;
