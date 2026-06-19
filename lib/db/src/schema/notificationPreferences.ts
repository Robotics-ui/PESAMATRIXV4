import { pgTable, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tradeAlerts: boolean("trade_alerts").notNull().default(true),
  subscriptionAlerts: boolean("subscription_alerts").notNull().default(true),
  announcements: boolean("announcements").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("notification_prefs_user_id_idx").on(table.userId),
]);

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferencesTable).omit({ id: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;
