import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const learningResourcesTable = pgTable("learning_resources", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  resourceType: text("resource_type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LearningResource = typeof learningResourcesTable.$inferSelect;
