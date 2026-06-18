import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, bindingsTable, subscriptionsTable, slaveAccountsTable, strategiesTable } from "@workspace/db";
import { CreateBindingBody, DeleteBindingParams } from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { syncSlaveSubscriberToCopyFactory } from "../lib/metaapi";

const router = Router();

router.get("/bindings", authenticate, async (req, res): Promise<void> => {
  const userStrategies = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, req.userId!));

  const strategyIds = userStrategies.map((s) => s.id);

  if (strategyIds.length === 0) {
    res.json([]);
    return;
  }

  // Use inArray to fetch all bindings in a single query (avoid N+1)
  const allBindings = await db
    .select()
    .from(bindingsTable)
    .where(inArray(bindingsTable.strategyId, strategyIds));

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

  if (!sub || sub.status !== "active") {
    res.status(400).json({ error: "Active subscription required to bind accounts" });
    return;
  }

  // Verify strategy belongs to user
  const [strategy] = await db
    .select()
    .from(strategiesTable)
    .where(and(eq(strategiesTable.id, strategyId), eq(strategiesTable.userId, req.userId!)));

  if (!strategy) {
    res.status(400).json({ error: "Strategy not found" });
    return;
  }

  // Verify slave account belongs to user
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

  // Sync to CopyFactory — push all active bindings for this slave to MetaApi
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

  // Verify ownership: the binding's strategy must belong to this user
  const [existing] = await db
    .select({ id: bindingsTable.id, slaveAccountId: bindingsTable.slaveAccountId, strategyId: bindingsTable.strategyId })
    .from(bindingsTable)
    .where(eq(bindingsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Binding not found" });
    return;
  }

  // Confirm the strategy (and thus the binding) belongs to this user
  const [ownerStrategy] = await db
    .select({ id: strategiesTable.id })
    .from(strategiesTable)
    .where(and(eq(strategiesTable.id, existing.strategyId), eq(strategiesTable.userId, req.userId!)));

  if (!ownerStrategy) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(bindingsTable).where(eq(bindingsTable.id, params.data.id));

  // Sync to CopyFactory — remaining active bindings (may be empty)
  await syncSlaveSubscriberToCopyFactory(existing.slaveAccountId);

  res.sendStatus(204);
});

export default router;
