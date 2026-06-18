import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const strategiesTable = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  copyfactoryStrategyId: text("copyfactory_strategy_id"),
  strategyName: text("strategy_name").notNull(),
  masterAccountId: integer("master_account_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("strategies_user_id_idx").on(table.userId),
  index("strategies_master_account_id_idx").on(table.masterAccountId),
  index("strategies_copyfactory_strategy_id_idx").on(table.copyfactoryStrategyId),
]);

export const insertStrategySchema = createInsertSchema(strategiesTable).omit({ id: true, createdAt: true });
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategiesTable.$inferSelect;
