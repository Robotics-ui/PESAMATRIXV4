import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customerCareSettingsTable = pgTable("customer_care_settings", {
  id: serial("id").primaryKey(),
  phone1: text("phone1").notNull().default(""),
  phone2: text("phone2"),
  whatsapp: text("whatsapp").notNull().default(""),
  email: text("email").notNull().default(""),
  supportHours: text("support_hours").notNull().default("Mon-Fri 8AM-6PM"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerCareSettingsSchema = createInsertSchema(customerCareSettingsTable).omit({ id: true });
export type InsertCustomerCareSettings = z.infer<typeof insertCustomerCareSettingsSchema>;
export type CustomerCareSettings = typeof customerCareSettingsTable.$inferSelect;
