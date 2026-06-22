import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const faqsTable = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("draft"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("faqs_status_idx").on(table.status),
  index("faqs_category_idx").on(table.category),
  index("faqs_sort_order_idx").on(table.sortOrder),
]);

export const faqSearchLogsTable = pgTable("faq_search_logs", {
  id: serial("id").primaryKey(),
  searchTerm: text("search_term").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Faq = typeof faqsTable.$inferSelect;
export type FaqSearchLog = typeof faqSearchLogsTable.$inferSelect;
