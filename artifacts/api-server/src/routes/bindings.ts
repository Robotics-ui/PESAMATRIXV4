import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, bindingsTable, subscriptionsTable, slaveAccountsTable, strategiesTable, masterAccountsTable } from "@workspace/db";
import { CreateBindingBody, DeleteBindingParams } from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { requireActiveSubscription } from "../middlewares/requireActiveSubscription";
import { syncSlaveSubscriberToCopyFactory, ensureSlaveSubscriberRole } from "../lib/metaapi";
import { writeAuditLog } from "../lib/accountPoller";
import { logger } from "../lib/logger";

const router = Router();

// Statuses where the master is considered ready to accept subscribers
const BINDABLE_MASTER_STATUSES = new Set(["deployed", "strategy_created", "active"]);

router.get("/bindings", authenticate, requireActiveSubscription, async (req, res): Promise<void> => {
  // Return bindings for the current user's slave accounts (not filtered by strategy ownership —
  // subscribers bind to the admin's strategies so we must look up by slave ownership).
  const userSlaves = await db
    .select({ id: slaveAccountsTable.id })
    .from(slaveAccountsTable)
    .where(eq(slaveAccountsTable.userId, req.userId!));

  const slaveIds = userSlaves.map((s) => s.id);

  if (slaveIds.length === 0) {
    res.json([]);
    return;
  }

  const allBindings = await db
    .select()
    .from(bindingsTable)
    .where(inArray(bindingsTable.slaveAccountId, slaveIds));

  res.json(
    allBindings.map((b) => ({
      ...b,
      riskMultiplier: parseFloat(b.riskMultiplier as string),
    }))
  );
});

router.post("/bindings", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateBindingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { strategyId, slaveAccountId, riskMultiplier } = parsed.data;

  // Check active subscription
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!));

  if (!sub || (sub.status !== "active" && sub.status !== "free_trial")) {
    res.status(400).json({ error: "Active subscription or free trial required to bind accounts" });
    return;
  }

  // Verify strategy exists (no userId check — users may bind to the admin's strategy)
  const [strategy] = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.id, strategyId));

  if (!strategy) {
    res.status(400).json({ error: "Strategy not found" });
    return;
  }

  if (strategy.status !== "active") {
    res.status(400).json({ error: "This strategy is not yet active and cannot accept subscribers." });
    return;
  }

  // Verify master account is CONNECTED + DEPLOYED with a bindable lifecycle status
  const [master] = await db
    .select()
    .from(masterAccountsTable)
    .where(eq(masterAccountsTable.id, strategy.masterAccountId));

  const masterReady =
    master &&
    BINDABLE_MASTER_STATUSES.has(master.status) &&
    master.connectionStatus === "CONNECTED" &&
    master.deploymentStatus === "DEPLOYED";

  if (!masterReady) {
    res.status(400).json({
      error: `This strategy's master account is not ready (status: ${master?.status ?? "unknown"}, connection: ${master?.connectionStatus ?? "unknown"}). Wait for it to be Connected and Deployed before binding.`,
    });
    return;
  }

  // Verify slave account belongs to the requesting user
  const [slave] = await db
    .select()
    .from(slaveAccountsTable)
    .where(and(eq(slaveAccountsTable.id, slaveAccountId), eq(slaveAccountsTable.userId, req.userId!)));

  if (!slave) {
    res.status(400).json({ error: "Slave account not found" });
    return;
  }

  const [binding] = await db
    .insert(bindingsTable)
    .values({
      strategyId,
      slaveAccountId,
      riskMultiplier: riskMultiplier.toString(),
      status: "active",
    })
    .returning();

  // Advance master from "strategy_created" → "active" on first successful binding.
  // This unblocks the lifecycle: master cannot self-advance past strategy_created without a binding.
  if (master.status === "strategy_created") {
    await db
      .update(masterAccountsTable)
      .set({ status: "active" })
      .where(eq(masterAccountsTable.id, master.id));

    await writeAuditLog({
      masterAccountId: master.id,
      userId: master.userId,
      event: "first_binding_created",
      fromStatus: "strategy_created",
      toStatus: "active",
    });

    logger.info({ masterAccountId: master.id }, "Master advanced to active on first binding");
  }

  // Ensure subscriber role is registered before syncing subscriptions.
  await ensureSlaveSubscriberRole(slaveAccountId);
  await syncSlaveSubscriberToCopyFactory(slaveAccountId);

  res.status(201).json({
    ...binding,
    riskMultiplier: parseFloat(binding.riskMultiplier as string),
  });
});

router.delete("/bindings/:id", authenticate, async (req, res): Promise<void> => {
  const params = DeleteBindingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: bindingsTable.id, slaveAccountId: bindingsTable.slaveAccountId, strategyId: bindingsTable.strategyId })
    .from(bindingsTable)
    .where(eq(bindingsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Binding not found" });
    return;
  }

  // Verify the slave account belongs to the requesting user (ownership check on slave, not strategy)
  const [ownerSlave] = await db
    .select({ id: slaveAccountsTable.id })
    .from(slaveAccountsTable)
    .where(and(eq(slaveAccountsTable.id, existing.slaveAccountId), eq(slaveAccountsTable.userId, req.userId!)));

  if (!ownerSlave) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(bindingsTable).where(eq(bindingsTable.id, params.data.id));

  await syncSlaveSubscriberToCopyFactory(existing.slaveAccountId);

  res.sendStatus(204);
});

export default router;
