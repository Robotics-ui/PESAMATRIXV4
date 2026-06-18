import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const mediaUploadsTable = pgTable("media_uploads", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  mediaType: text("media_type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaUpload = typeof mediaUploadsTable.$inferSelect;
