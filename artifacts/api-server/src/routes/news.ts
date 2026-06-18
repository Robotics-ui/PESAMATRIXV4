import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

router.get("/news", authenticate, async (req, res): Promise<void> => {
  const isAdmin = req.userRole === "admin";
  const rows = await db
    .select()
    .from(newsArticlesTable)
    .where(isAdmin ? ne(newsArticlesTable.status, "deleted") : eq(newsArticlesTable.status, "published"));
  res.json(rows);
});

router.get("/news/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(newsArticlesTable).where(eq(newsArticlesTable.id, id));
  if (!row || row.status === "deleted") { res.status(404).json({ error: "Not found" }); return; }
  const isAdmin = req.userRole === "admin";
  if (!isAdmin && row.status !== "published") { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/news", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { headline, featuredImageUrl, summary, content, category, author } = req.body as Record<string, string>;
  if (!headline || !content || !category || !author) {
    res.status(400).json({ error: "headline, content, category and author are required" });
    return;
  }
  const [row] = await db.insert(newsArticlesTable).values({
    createdBy: req.userId!,
    headline, featuredImageUrl: featuredImageUrl ?? null,
    summary: summary ?? null, content, category, author, status: "draft",
  }).returning();
  res.status(201).json(row);
});

router.patch("/news/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { headline, featuredImageUrl, summary, content, category, author } = req.body as Record<string, string>;
  const [row] = await db.update(newsArticlesTable)
    .set({ headline, featuredImageUrl, summary, content, category, author, updatedAt: new Date() })
    .where(and(eq(newsArticlesTable.id, id), ne(newsArticlesTable.status, "deleted")))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/news/:id/publish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(newsArticlesTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(newsArticlesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/news/:id/unpublish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(newsArticlesTable)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(newsArticlesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/news/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const permanent = req.query.permanent === "true";
  if (permanent) {
    await db.delete(newsArticlesTable).where(eq(newsArticlesTable.id, id));
  } else {
    await db.update(newsArticlesTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(newsArticlesTable.id, id));
  }
  res.sendStatus(204);
});

export default router;
