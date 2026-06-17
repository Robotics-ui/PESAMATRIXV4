import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bindingsTable = pgTable("strategy_subscribers", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  slaveAccountId: integer("slave_account_id").notNull(),
  riskMultiplier: numeric("risk_multiplier", { precision: 5, scale: 2 }).notNull().default("1"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBindingSchema = createInsertSchema(bindingsTable).omit({ id: true, createdAt: true });
export type InsertBinding = z.infer<typeof insertBindingSchema>;
export type Binding = typeof bindingsTable.$inferSelect;
