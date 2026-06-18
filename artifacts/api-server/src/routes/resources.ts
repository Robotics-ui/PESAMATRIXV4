import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, learningResourcesTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

router.get("/resources", authenticate, async (req, res): Promise<void> => {
  const isAdmin = req.userRole === "admin";
  const rows = await db
    .select()
    .from(learningResourcesTable)
    .where(isAdmin ? ne(learningResourcesTable.status, "deleted") : eq(learningResourcesTable.status, "published"));
  res.json(rows);
});

router.get("/resources/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(learningResourcesTable).where(eq(learningResourcesTable.id, id));
  if (!row || row.status === "deleted") { res.status(404).json({ error: "Not found" }); return; }
  const isAdmin = req.userRole === "admin";
  if (!isAdmin && row.status !== "published") { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/resources", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { title, description, category, resourceType, url, thumbnailUrl } = req.body as Record<string, string>;
  if (!title || !category || !resourceType || !url) {
    res.status(400).json({ error: "title, category, resourceType and url are required" });
    return;
  }
  const [row] = await db.insert(learningResourcesTable).values({
    createdBy: req.userId!,
    title, description: description ?? null, category, resourceType, url,
    thumbnailUrl: thumbnailUrl ?? null, status: "draft",
  }).returning();
  res.status(201).json(row);
});

router.patch("/resources/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, description, category, resourceType, url, thumbnailUrl } = req.body as Record<string, string>;
  const [row] = await db.update(learningResourcesTable)
    .set({ title, description, category, resourceType, url, thumbnailUrl, updatedAt: new Date() })
    .where(and(eq(learningResourcesTable.id, id), ne(learningResourcesTable.status, "deleted")))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/resources/:id/publish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(learningResourcesTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(learningResourcesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/resources/:id/unpublish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(learningResourcesTable)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(learningResourcesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/resources/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const permanent = req.query.permanent === "true";
  if (permanent) {
    await db.delete(learningResourcesTable).where(eq(learningResourcesTable.id, id));
  } else {
    await db.update(learningResourcesTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(learningResourcesTable.id, id));
  }
  res.sendStatus(204);
});

export default router;
