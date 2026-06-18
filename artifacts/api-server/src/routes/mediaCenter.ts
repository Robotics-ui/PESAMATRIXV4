import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, mediaUploadsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

router.get("/media", authenticate, async (req, res): Promise<void> => {
  const isAdmin = req.userRole === "admin";
  const rows = await db
    .select()
    .from(mediaUploadsTable)
    .where(isAdmin ? ne(mediaUploadsTable.status, "deleted") : eq(mediaUploadsTable.status, "published"));
  res.json(rows);
});

router.post("/media", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { title, description, mediaType, url, thumbnailUrl, category } = req.body as Record<string, string>;
  if (!title || !mediaType || !url) {
    res.status(400).json({ error: "title, mediaType and url are required" });
    return;
  }
  const [row] = await db.insert(mediaUploadsTable).values({
    createdBy: req.userId!,
    title, description: description ?? null, mediaType, url,
    thumbnailUrl: thumbnailUrl ?? null, category: category ?? null,
    status: "draft",
  }).returning();
  res.status(201).json(row);
});

router.patch("/media/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, description, mediaType, url, thumbnailUrl, category } = req.body as Record<string, string>;
  const [row] = await db.update(mediaUploadsTable)
    .set({ title, description, mediaType, url, thumbnailUrl, category, updatedAt: new Date() })
    .where(and(eq(mediaUploadsTable.id, id), ne(mediaUploadsTable.status, "deleted")))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/media/:id/publish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(mediaUploadsTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaUploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/media/:id/unpublish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(mediaUploadsTable)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(mediaUploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/media/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const permanent = req.query.permanent === "true";
  if (permanent) {
    await db.delete(mediaUploadsTable).where(eq(mediaUploadsTable.id, id));
  } else {
    await db.update(mediaUploadsTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(mediaUploadsTable.id, id));
  }
  res.sendStatus(204);
});

export default router;
