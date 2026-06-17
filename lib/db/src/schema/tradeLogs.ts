import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradeLogsTable = pgTable("trade_logs", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  slaveAccountId: integer("slave_account_id"),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeLogSchema = createInsertSchema(tradeLogsTable).omit({ id: true, createdAt: true });
export type InsertTradeLog = z.infer<typeof insertTradeLogSchema>;
export type TradeLog = typeof tradeLogsTable.$inferSelect;
