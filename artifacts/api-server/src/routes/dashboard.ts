import { Router } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, subscriptionsTable, masterAccountsTable, slaveAccountsTable, strategiesTable, bindingsTable, paymentsTable, tradeLogsTable } from "@workspace/db";
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
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

router.get("/dashboard/summary", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  const subscription = sub
    ? { ...sub, remainingTradingDays: countRemainingTradingDays(sub.endDate ?? null) }
    : { id: 0, userId, status: "expired", startDate: null, endDate: null, daysPaid: 0, remainingTradingDays: 0, createdAt: new Date() };

  const masterAccounts = await db.select().from(masterAccountsTable).where(eq(masterAccountsTable.userId, userId));
  const slaveAccounts = await db.select().from(slaveAccountsTable).where(eq(slaveAccountsTable.userId, userId));
  const strategies = await db.select().from(strategiesTable).where(eq(strategiesTable.userId, userId));

  const strategyIds = strategies.map((s) => s.id);
  let activeBindings = 0;

  if (strategyIds.length > 0) {
    const allBindings = await db
      .select()
      .from(bindingsTable)
      .where(inArray(bindingsTable.strategyId, strategyIds));
    activeBindings = allBindings.filter((b) => b.status === "active").length;
  }

  const recentPayments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(5);

  let recentTradeLogs: typeof tradeLogsTable.$inferSelect[] = [];
  if (strategyIds.length > 0) {
    recentTradeLogs = await db
      .select()
      .from(tradeLogsTable)
      .where(inArray(tradeLogsTable.strategyId, strategyIds))
      .orderBy(desc(tradeLogsTable.createdAt))
      .limit(5);
  }

  res.json({
    subscription,
    masterAccounts: masterAccounts.length,
    slaveAccounts: slaveAccounts.length,
    strategies: strategies.length,
    activeBindings,
    recentPayments: recentPayments.map((p) => ({ ...p, amount: parseFloat(p.amount as string) })),
    recentTradeLogs,
  });
});

export default router;
