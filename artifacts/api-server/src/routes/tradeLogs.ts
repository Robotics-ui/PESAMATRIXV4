import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, tradeLogsTable, strategiesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.get("/trade-logs", authenticate, async (req, res): Promise<void> => {
  const userStrategies = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, req.userId!));

  const strategyIds = userStrategies.map((s) => s.id);

  if (strategyIds.length === 0) {
    res.json([]);
    return;
  }

  const logs = await db
    .select()
    .from(tradeLogsTable)
    .where(inArray(tradeLogsTable.strategyId, strategyIds))
    .orderBy(desc(tradeLogsTable.createdAt))
    .limit(100);

  res.json(logs);
});

export default router;
