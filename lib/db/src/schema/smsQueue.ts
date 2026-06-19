import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smsQueueTable = pgTable("sms_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sms_queue_status_idx").on(table.status),
  index("sms_queue_scheduled_idx").on(table.scheduledFor),
  index("sms_queue_user_id_idx").on(table.userId),
]);

export const insertSmsQueueSchema = createInsertSchema(smsQueueTable).omit({ id: true, createdAt: true });
export type InsertSmsQueue = z.infer<typeof insertSmsQueueSchema>;
export type SmsQueue = typeof smsQueueTable.$inferSelect;
