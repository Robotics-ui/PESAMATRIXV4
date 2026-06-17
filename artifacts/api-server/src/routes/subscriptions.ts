import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

function countRemainingTradingDays(endDate: Date | null): number {
  if (!endDate) return 0;
  const now = new Date();
  if (now >= endDate) return 0;

  let count = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < endDate) {
    const day = cursor.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

router.get("/subscriptions/my", authenticate, async (req, res): Promise<void> => {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.userId!));

  if (!sub) {
    // Auto-create if missing
    const [newSub] = await db
      .insert(subscriptionsTable)
      .values({ userId: req.userId!, status: "expired", daysPaid: 0 })
      .returning();
    res.json({ ...newSub, remainingTradingDays: 0 });
    return;
  }

  const remainingTradingDays = countRemainingTradingDays(sub.endDate ?? null);

  // Auto-expire if end date passed
  if (sub.status === "active" && sub.endDate && new Date() > sub.endDate) {
    await db.update(subscriptionsTable).set({ status: "expired" }).where(eq(subscriptionsTable.id, sub.id));
    res.json({ ...sub, status: "expired", remainingTradingDays: 0 });
    return;
  }

  res.json({ ...sub, remainingTradingDays });
});

export { countRemainingTradingDays };
export default router;
