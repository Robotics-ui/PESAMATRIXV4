import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const newsArticlesTable = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(),
  headline: text("headline").notNull(),
  featuredImageUrl: text("featured_image_url"),
  summary: text("summary"),
  content: text("content").notNull(),
  category: text("category").notNull(),
  author: text("author").notNull(),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsArticle = typeof newsArticlesTable.$inferSelect;
