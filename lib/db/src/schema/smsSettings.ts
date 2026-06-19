import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smsSettingsTable = pgTable("sms_settings", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull().default(""),
  apiUrl: text("api_url").notNull().default(""),
  apiKey: text("api_key").notNull().default(""),
  apiSecret: text("api_secret").notNull().default(""),
  senderId: text("sender_id").notNull().default("PESAMTRX"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSmsSettingsSchema = createInsertSchema(smsSettingsTable).omit({ id: true });
export type InsertSmsSettings = z.infer<typeof insertSmsSettingsSchema>;
export type SmsSettings = typeof smsSettingsTable.$inferSelect;
