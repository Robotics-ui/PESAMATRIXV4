import { eq, and, isNotNull } from "drizzle-orm";
import { db, slaveAccountsTable, subscriptionsTable, bindingsTable, strategiesTable } from "@workspace/db";
import { ensureSlaveSubscriberRole, syncSlaveSubscriberToCopyFactory } from "./metaapi";
import { logger } from "./logger";

/**
 * Auto-creates bindings between a slave account and all active strategies
 * when the slave is connected and the user has an active subscription.
 * Idempotent — skips strategies that already have a binding for this slave.
 * Called from the account poller when a slave first becomes connected.
 */
export async function autoBindSlaveAccount(slaveAccountId: number): Promise<void> {
  const [slave] = await db
    .select()
    .from(slaveAccountsTable)
    .where(eq(slaveAccountsTable.id, slaveAccountId));

  if (!slave?.metaapiAccountId) {
    logger.debug({ slaveAccountId }, "Auto-bind skipped: slave has no MetaApi account ID");
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, slave.userId));

  if (!sub || (sub.status !== "active" && sub.status !== "free_trial")) {
    logger.debug({ slaveAccountId, userId: slave.userId }, "Auto-bind skipped: no active subscription");
    return;
  }

  const activeStrategies = await db
    .select()
    .from(strategiesTable)
    .where(and(eq(strategiesTable.status, "active"), isNotNull(strategiesTable.copyfactoryStrategyId)));

  if (activeStrategies.length === 0) {
    logger.debug({ slaveAccountId }, "Auto-bind skipped: no active strategies with CopyFactory IDs");
    return;
  }

  const existingBindings = await db
    .select({ strategyId: bindingsTable.strategyId })
    .from(bindingsTable)
    .where(eq(bindingsTable.slaveAccountId, slaveAccountId));

  const boundStrategyIds = new Set(existingBindings.map((b) => b.strategyId));

  let newBindingsCreated = 0;

  for (const strategy of activeStrategies) {
    if (boundStrategyIds.has(strategy.id)) {
      logger.debug({ slaveAccountId, strategyId: strategy.id }, "Auto-bind: binding already exists — skipping");
      continue;
    }

    await db.insert(bindingsTable).values({
      strategyId: strategy.id,
      slaveAccountId,
      riskMultiplier: "1",
      status: "active",
    });

    newBindingsCreated++;
    logger.info(
      { slaveAccountId, strategyId: strategy.id, strategyName: strategy.strategyName },
      "Auto-binding created"
    );
  }

  if (newBindingsCreated > 0 || existingBindings.length > 0) {
    await ensureSlaveSubscriberRole(slaveAccountId);
    await syncSlaveSubscriberToCopyFactory(slaveAccountId);
    logger.info(
      { slaveAccountId, newBindings: newBindingsCreated, totalStrategies: activeStrategies.length },
      "Auto-bind complete: subscriber registered and subscriptions pushed to CopyFactory"
    );
  }
}
