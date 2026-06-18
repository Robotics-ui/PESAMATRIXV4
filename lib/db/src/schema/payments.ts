import { pgTable, serial, integer, text, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phone: text("phone").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  mpesaReceipt: text("mpesa_receipt"),
  checkoutRequestId: text("checkout_request_id"),
  status: text("status").notNull().default("pending"),
  days: integer("days").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("payments_user_id_idx").on(table.userId),
  index("payments_status_idx").on(table.status),
  uniqueIndex("payments_checkout_request_id_idx").on(table.checkoutRequestId),
  uniqueIndex("payments_mpesa_receipt_idx").on(table.mpesaReceipt),
]);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
