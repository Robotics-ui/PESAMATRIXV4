import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bindingsTable = pgTable("strategy_subscribers", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  slaveAccountId: integer("slave_account_id").notNull(),
  riskMultiplier: numeric("risk_multiplier", { precision: 5, scale: 2 }).notNull().default("1"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bindings_strategy_id_idx").on(table.strategyId),
  index("bindings_slave_account_id_idx").on(table.slaveAccountId),
  index("bindings_status_idx").on(table.status),
]);

export const insertBindingSchema = createInsertSchema(bindingsTable).omit({ id: true, createdAt: true });
export type InsertBinding = z.infer<typeof insertBindingSchema>;
export type Binding = typeof bindingsTable.$inferSelect;
