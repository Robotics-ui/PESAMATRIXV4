import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, announcementsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

router.get("/announcements", authenticate, async (req, res): Promise<void> => {
  const isAdmin = req.userRole === "admin";
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(isAdmin ? ne(announcementsTable.status, "deleted") : eq(announcementsTable.status, "published"));
  res.json(rows);
});

router.get("/announcements/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id));
  if (!row || row.status === "deleted") { res.status(404).json({ error: "Not found" }); return; }
  const isAdmin = req.userRole === "admin";
  if (!isAdmin && row.status !== "published") { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/announcements", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { title, message, imageUrl, priority } = req.body as Record<string, string>;
  if (!title || !message) {
    res.status(400).json({ error: "title and message are required" });
    return;
  }
  const [row] = await db.insert(announcementsTable).values({
    createdBy: req.userId!,
    title, message,
    imageUrl: imageUrl ?? null,
    priority: priority ?? "normal",
    status: "draft",
  }).returning();
  res.status(201).json(row);
});

router.patch("/announcements/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, message, imageUrl, priority } = req.body as Record<string, string>;
  const [row] = await db.update(announcementsTable)
    .set({ title, message, imageUrl, priority, updatedAt: new Date() })
    .where(and(eq(announcementsTable.id, id), ne(announcementsTable.status, "deleted")))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/announcements/:id/publish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(announcementsTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/announcements/:id/unpublish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(announcementsTable)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/announcements/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const permanent = req.query.permanent === "true";
  if (permanent) {
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  } else {
    await db.update(announcementsTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(announcementsTable.id, id));
  }
  res.sendStatus(204);
});

export default router;
