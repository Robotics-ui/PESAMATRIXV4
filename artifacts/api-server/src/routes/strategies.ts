import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, strategiesTable, masterAccountsTable, bindingsTable, slaveAccountsTable } from "@workspace/db";
import { CreateStrategyBody, DeleteStrategyParams } from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { getMetaApiToken, syncSlaveSubscriberToCopyFactory } from "../lib/metaapi";
import { logger } from "../lib/logger";

const router = Router();

// Statuses that block strategy creation on a master account
const BLOCKED_STATUSES = new Set(["pending_approval", "rejected", "suspended"]);

router.get("/strategies", authenticate, async (req, res): Promise<void> => {
  const strategies = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, req.userId!));

  res.json(strategies);
});

router.post("/strategies", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { strategyName, masterAccountId } = parsed.data;

  const [masterAccount] = await db
    .select()
    .from(masterAccountsTable)
    .where(and(eq(masterAccountsTable.id, masterAccountId), eq(masterAccountsTable.userId, req.userId!)));

  if (!masterAccount) {
    res.status(400).json({ error: "Master account not found" });
    return;
  }

  if (BLOCKED_STATUSES.has(masterAccount.status)) {
    const reason =
      masterAccount.status === "pending_approval"
        ? "Master account is pending admin approval. Strategies can only be created once the account is approved and deployed."
        : masterAccount.status === "suspended"
          ? "Master account is suspended and cannot be used for strategies."
          : "Master account was rejected and cannot be used for strategies.";
    res.status(400).json({ error: reason });
    return;
  }

  let copyfactoryStrategyId: string | null = null;

  const metaapiToken = await getMetaApiToken();
  if (metaapiToken && masterAccount.metaapiAccountId) {
    try {
      const stratId = `strategy-${Date.now()}`;
      const response = await fetch(
        `https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai/users/current/configuration/strategies/${stratId}`,
        {
          method: "PUT",
          headers: {
            "auth-token": metaapiToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: strategyName,
            positionLifecycle: "hedging",
            connectionId: masterAccount.metaapiAccountId,
          }),
        }
      );
      if (response.ok) {
        copyfactoryStrategyId = stratId;
      } else {
        logger.warn({ status: response.status, stratId }, "CopyFactory strategy creation returned non-OK");
      }
    } catch (err) {
      logger.warn({ err }, "CopyFactory strategy creation failed — storing locally only");
    }
  }

  const [strategy] = await db
    .insert(strategiesTable)
    .values({
      userId: req.userId!,
      copyfactoryStrategyId,
      strategyName,
      masterAccountId,
      status: "active",
    })
    .returning();

  res.status(201).json(strategy);
});

router.delete("/strategies/:id", authenticate, async (req, res): Promise<void> => {
  const params = DeleteStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [strategy] = await db
    .select()
    .from(strategiesTable)
    .where(and(eq(strategiesTable.id, params.data.id), eq(strategiesTable.userId, req.userId!)));

  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  // Collect affected slave accounts before deleting bindings
  const affectedBindings = await db
    .select({ slaveAccountId: bindingsTable.slaveAccountId })
    .from(bindingsTable)
    .where(eq(bindingsTable.strategyId, strategy.id));

  const affectedSlaveIds = [...new Set(affectedBindings.map((b) => b.slaveAccountId))];

  // Delete all bindings for this strategy
  await db.delete(bindingsTable).where(eq(bindingsTable.strategyId, strategy.id));

  // Delete the strategy record
  await db
    .delete(strategiesTable)
    .where(and(eq(strategiesTable.id, params.data.id), eq(strategiesTable.userId, req.userId!)));

  // Remove the CopyFactory strategy (best-effort)
  const metaapiToken = await getMetaApiToken();
  if (metaapiToken && strategy.copyfactoryStrategyId) {
    fetch(
      `https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai/users/current/configuration/strategies/${strategy.copyfactoryStrategyId}`,
      { method: "DELETE", headers: { "auth-token": metaapiToken } }
    ).catch((err) => {
      logger.warn({ err, copyfactoryStrategyId: strategy.copyfactoryStrategyId }, "CopyFactory strategy delete failed");
    });
  }

  // Re-sync CopyFactory for each affected slave (removes this strategy from their subscriptions)
  for (const slaveId of affectedSlaveIds) {
    const [slave] = await db.select({ id: slaveAccountsTable.id }).from(slaveAccountsTable).where(eq(slaveAccountsTable.id, slaveId));
    if (slave) {
      await syncSlaveSubscriberToCopyFactory(slaveId).catch((err) => {
        logger.warn({ err, slaveId }, "CopyFactory sync after strategy delete failed");
      });
    }
  }

  res.sendStatus(204);
});

export default router;
