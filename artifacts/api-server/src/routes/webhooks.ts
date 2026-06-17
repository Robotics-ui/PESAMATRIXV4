import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, tradeLogsTable, strategiesTable, slaveAccountsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /webhooks/copyfactory
 *
 * Receives trade execution events from MetaApi CopyFactory.
 * Register this URL in your MetaApi CopyFactory strategy/subscriber listener:
 *   https://<your-domain>/webhooks/copyfactory?secret=<COPYFACTORY_WEBHOOK_SECRET>
 *
 * If COPYFACTORY_WEBHOOK_SECRET is not set, all requests are accepted (dev mode).
 */
router.post("/webhooks/copyfactory", async (req, res): Promise<void> => {
  // Optional secret validation via query param
  const secret = process.env.COPYFACTORY_WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = req.body as Record<string, unknown>;

    logger.info({ payload }, "CopyFactory webhook received");

    // CopyFactory sends strategyId (their ID) and optionally subscriberId
    const copyfactoryStrategyId = payload.strategyId as string | undefined;
    const subscriberId = payload.subscriberId as string | undefined;
    const deal = payload.deal as Record<string, unknown> | undefined;

    if (!copyfactoryStrategyId) {
      // Could be a health-check ping — acknowledge and move on
      res.json({ received: true });
      return;
    }

    // Resolve internal strategy by CopyFactory strategy ID
    const [strategy] = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.copyfactoryStrategyId, copyfactoryStrategyId));

    if (!strategy) {
      logger.warn({ copyfactoryStrategyId }, "Webhook: unknown CopyFactory strategy ID");
      res.json({ received: true });
      return;
    }

    // Optionally resolve slave account by CopyFactory subscriber ID
    let slaveAccountId: number | null = null;
    if (subscriberId) {
      const [slave] = await db
        .select()
        .from(slaveAccountsTable)
        .where(eq(slaveAccountsTable.subscriberId, subscriberId));
      if (slave) slaveAccountId = slave.id;
    }

    // Derive a short action label from the deal type
    const rawType =
      (deal?.type as string | undefined) ??
      (payload.type as string | undefined) ??
      "EVENT";
    const action = rawType
      .replace("DEAL_TYPE_", "")
      .replace("ORDER_TYPE_", "")
      .replace("COPYFACTORY_STRATEGY_", "");

    // Persist rich details as a JSON string for the trade logs UI
    const details = JSON.stringify({
      transactionId: payload.id ?? null,
      symbol: deal?.symbol ?? null,
      volume: deal?.volume ?? null,
      profit: deal?.profit ?? null,
      openPrice: deal?.entryPrice ?? deal?.openPrice ?? null,
      closePrice: deal?.exitPrice ?? deal?.closePrice ?? null,
      entryType: deal?.entryType ?? null,
      time: payload.time ?? new Date().toISOString(),
    });

    await db.insert(tradeLogsTable).values({
      strategyId: strategy.id,
      slaveAccountId,
      action,
      details,
    });

    logger.info(
      { strategyId: strategy.id, slaveAccountId, action },
      "CopyFactory trade event logged"
    );

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "CopyFactory webhook processing error");
    // Always return 200 to prevent MetaApi from retrying endlessly
    res.json({ received: true, error: "Processing failed" });
  }
});

export default router;
