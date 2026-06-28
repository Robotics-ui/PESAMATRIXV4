import { inArray, isNotNull, isNull, and, eq } from "drizzle-orm";
import { db, masterAccountsTable, slaveAccountsTable, strategiesTable, masterAccountAuditLogsTable, bindingsTable } from "@workspace/db";
import { getMetaApiToken, callMetaApi, mapMetaApiState, checkAndMarkProviderRole, ensureSlaveSubscriberRole } from "./metaapi";
import { autoBindSlaveAccount } from "./autoBinding";
import { logger } from "./logger";
import {
  registerWorker,
  workerTickStart,
  workerTickComplete,
  workerTickFailed,
} from "./workerRegistry";

const PROVISIONING_API = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const POLL_INTERVAL_MS = 30_000;
const MONITOR_INTERVAL_MS = 5 * 60 * 1000;
const CONCURRENCY = 20;

// Statuses that need 30s lifecycle-advancement polling
const ADVANCING_STATUSES = ["deploying", "connecting", "synchronizing", "deployed", "strategy_created"];
// Statuses that need 5-min health monitoring
const MONITOR_STATUSES = ["active", "suspended"];
// Slave statuses (unchanged lifecycle)
const SLAVE_NON_TERMINAL_STATUSES = ["deploying", "connecting", "synchronizing"];

let pollerRunning = false;
let monitorRunning = false;
let pollCount = 0;
let monitorCount = 0;

// Tracks slave IDs currently undergoing CopyFactory subscriber registration to prevent
// duplicate concurrent attempts across poller ticks.
const cfRegistrationInProgress = new Set<number>();
// Tracks slave IDs currently undergoing auto-binding to prevent duplicate concurrent attempts.
const cfAutoBindInProgress = new Set<number>();

type MetaApiAccountResponse = {
  state?: string;
  connectionStatus?: string;
  synchronizationStatus?: string;
  region?: string;
  message?: string;
};

// ── Audit log helper ──────────────────────────────────────────────────────────

export async function writeAuditLog(params: {
  masterAccountId: number;
  userId: number;
  adminId?: number | null;
  event: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    await db.insert(masterAccountAuditLogsTable).values({
      masterAccountId: params.masterAccountId,
      userId: params.userId,
      adminId: params.adminId ?? null,
      event: params.event,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      reason: params.reason ?? null,
    });
  } catch (err) {
    logger.warn({ err, masterAccountId: params.masterAccountId, event: params.event }, "Failed to write master account audit log");
  }
}

// ── Strategy existence helper ─────────────────────────────────────────────────

async function hasStrategyForMaster(masterAccountId: number): Promise<boolean> {
  const rows = await db
    .select({ id: strategiesTable.id })
    .from(strategiesTable)
    .where(eq(strategiesTable.masterAccountId, masterAccountId))
    .limit(1);
  return rows.length > 0;
}

// ── Master lifecycle advancement (30s poller) ─────────────────────────────────

async function ensureProviderRegistered(
  id: number,
  metaapiAccountId: string,
  broker: string,
  mt5Login: string,
  copyFactoryProviderStatus: string | null
): Promise<void> {
  if (copyFactoryProviderStatus === "registered") return;
  // Awaited — strategy creation is blocked until provider is registered, so we must
  // complete registration before the account can advance past "deployed".
  try {
    await checkAndMarkProviderRole(id, metaapiAccountId);
  } catch (err) {
    logger.warn({ err, id }, "CopyFactory auto-provider registration failed");
  }
}

async function advanceMasterAccount(
  id: number,
  metaapiAccountId: string,
  currentStatus: string,
  userId: number,
  token: string,
  broker: string,
  mt5Login: string,
  copyFactoryProviderStatus: string | null
): Promise<void> {
  try {
    const result = await callMetaApi<MetaApiAccountResponse>(
      "GET",
      `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`,
      token
    );
    if (!result.ok) return;

    const data = result.data;
    const state = (data.state ?? "").toUpperCase();
    const conn = (data.connectionStatus ?? "").toUpperCase();

    let newStatus: string | null = null;
    let event: string | null = null;

    if (state === "FAILED" || state === "ERROR") {
      newStatus = "failed";
      event = "deployment_failed";
    } else if (state === "CONNECTED" || (state === "DEPLOYED" && conn === "CONNECTED")) {
      const stratExists = await hasStrategyForMaster(id);
      newStatus = stratExists ? "active" : "deployed";
      event = stratExists ? "activated" : "deployment_success";
    } else if (state === "DEPLOYED") {
      const stratExists = await hasStrategyForMaster(id);
      newStatus = stratExists ? "strategy_created" : "deployed";
      event = "deployment_success";
    } else if (state === "DEPLOYING") {
      newStatus = "deploying";
    } else if (state === "CONNECTING") {
      newStatus = "connecting";
    } else if (state === "SYNCHRONIZING") {
      newStatus = "synchronizing";
    } else if (state === "DISCONNECTING" || state === "DISCONNECTED" || state === "UNDEPLOYING") {
      newStatus = "disconnected";
    }

    // If status hasn't changed, retry provider registration for accounts stuck at a live
    // state where the provider was never registered (e.g. registered before this feature
    // existed, or a previous registration attempt failed and was never retried).
    if (newStatus === null || newStatus === currentStatus) {
      const PROVIDER_RETRY_STATUSES = new Set(["deployed", "strategy_created", "active"]);
      if (PROVIDER_RETRY_STATUSES.has(currentStatus) && copyFactoryProviderStatus !== "registered") {
        logger.info({ id, metaapiAccountId, currentStatus }, "Provider not registered — retrying on poller tick");
        await ensureProviderRegistered(id, metaapiAccountId, broker, mt5Login, copyFactoryProviderStatus);
      }
      return;
    }

    await db
      .update(masterAccountsTable)
      .set({
        status: newStatus,
        deploymentStatus: data.state ?? null,
        connectionStatus: data.connectionStatus ?? null,
        synchronizationStatus: data.synchronizationStatus ?? null,
        metaapiRegion: data.region ?? null,
        lastErrorMessage: newStatus === "failed" ? (data.message ?? "Account in FAILED state") : null,
        lastCheckedAt: new Date(),
      })
      .where(eq(masterAccountsTable.id, id));

    logger.info(
      { id, metaapiAccountId, from: currentStatus, to: newStatus, state, conn },
      "Master account status advanced"
    );

    if (event) {
      await writeAuditLog({
        masterAccountId: id,
        userId,
        event,
        fromStatus: currentStatus,
        toStatus: newStatus,
      });
    }

    // Auto-register as CopyFactory provider when account first reaches a live state.
    // This is awaited — strategy creation is blocked until copyFactoryProviderStatus === "registered".
    const PROVIDER_ELIGIBLE = new Set(["deployed", "strategy_created", "active"]);
    if (PROVIDER_ELIGIBLE.has(newStatus)) {
      await ensureProviderRegistered(id, metaapiAccountId, broker, mt5Login, copyFactoryProviderStatus);
    }
  } catch (err) {
    logger.warn({ id, metaapiAccountId, err }, "Failed to advance master account lifecycle");
  }
}

// ── Master health monitor (5-min poller) ──────────────────────────────────────

async function monitorMasterAccount(
  id: number,
  metaapiAccountId: string,
  currentStatus: string,
  userId: number,
  token: string
): Promise<void> {
  try {
    const result = await callMetaApi<MetaApiAccountResponse>(
      "GET",
      `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`,
      token
    );
    if (!result.ok) return;

    const data = result.data;
    const state = (data.state ?? "").toUpperCase();
    const conn = (data.connectionStatus ?? "").toUpperCase();

    const isConnected =
      state === "CONNECTED" || (state === "DEPLOYED" && conn === "CONNECTED");
    const isLost =
      state === "FAILED" ||
      state === "DISCONNECTED" ||
      state === "DISCONNECTING" ||
      conn === "DISCONNECTED";

    let newStatus: string | null = null;
    let event: string | null = null;

    if (currentStatus === "active" && isLost) {
      newStatus = "suspended";
      event = "suspended";
    } else if (currentStatus === "suspended" && isConnected) {
      newStatus = "active";
      event = "reactivated";
    }

    if (newStatus === null) return;

    await db
      .update(masterAccountsTable)
      .set({
        status: newStatus,
        connectionStatus: data.connectionStatus ?? null,
        synchronizationStatus: data.synchronizationStatus ?? null,
        lastCheckedAt: new Date(),
      })
      .where(eq(masterAccountsTable.id, id));

    logger.info(
      { id, metaapiAccountId, from: currentStatus, to: newStatus, state, conn },
      "Master account health monitor updated"
    );

    await writeAuditLog({
      masterAccountId: id,
      userId,
      event: event!,
      fromStatus: currentStatus,
      toStatus: newStatus,
    });
  } catch (err) {
    logger.warn({ id, metaapiAccountId, err }, "Failed to monitor master account health");
  }
}

// ── Slave account polling ─────────────────────────────────────────────────────

async function checkSingleSlaveAccount(
  id: number,
  metaapiAccountId: string,
  token: string,
  copyFactorySubscriberId: string | null
): Promise<void> {
  try {
    const result = await callMetaApi<MetaApiAccountResponse>(
      "GET",
      `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`,
      token
    );
    if (!result.ok) return;

    const data = result.data;
    const newStatus = mapMetaApiState(data.state ?? "");

    await db
      .update(slaveAccountsTable)
      .set({
        status: newStatus,
        deploymentStatus: data.state ?? null,
        connectionStatus: data.connectionStatus ?? null,
        synchronizationStatus: data.synchronizationStatus ?? null,
        metaapiRegion: data.region ?? null,
        lastErrorMessage: newStatus === "failed" ? (data.message ?? "Account in FAILED state") : null,
        lastCheckedAt: new Date(),
      })
      .where(eq(slaveAccountsTable.id, id));

    logger.debug(
      { id, metaapiAccountId, state: data.state, connectionStatus: data.connectionStatus, newStatus },
      "Slave account polled"
    );

    // Auto-register as CopyFactory subscriber AND auto-bind the first time the account becomes connected.
    if (newStatus === "connected" && !copyFactorySubscriberId && !cfRegistrationInProgress.has(id)) {
      cfRegistrationInProgress.add(id);
      logger.info({ id, metaapiAccountId }, "Slave reached connected — triggering CopyFactory subscriber registration and auto-bind");
      ensureSlaveSubscriberRole(id)
        .then(() => autoBindSlaveAccount(id))
        .catch((err) => logger.warn({ id, metaapiAccountId, err }, "Auto CopyFactory subscriber registration/auto-bind failed during poll"))
        .finally(() => cfRegistrationInProgress.delete(id));
    } else if (newStatus === "connected" && copyFactorySubscriberId && !cfAutoBindInProgress.has(id)) {
      // Subscriber already registered — ensure bindings are up to date (handles strategy created after connect)
      cfAutoBindInProgress.add(id);
      autoBindSlaveAccount(id)
        .catch((err) => logger.warn({ id, metaapiAccountId, err }, "Auto-bind (reconnect) failed during poll"))
        .finally(() => cfAutoBindInProgress.delete(id));
    }
  } catch (err) {
    logger.warn({ id, metaapiAccountId, err }, "Failed to poll slave account");
  }
}

// ── 30-second lifecycle advancement tick ─────────────────────────────────────

async function runPollerTick(): Promise<void> {
  if (pollerRunning) {
    logger.debug("Account poller tick skipped — previous run still in progress");
    return;
  }
  pollerRunning = true;
  const startedAt = Date.now();
  const pollerStartedAt = new Date().toISOString();
  workerTickStart("account-poller");
  let pollerFailed = false;
  try {
    const token = await getMetaApiToken();
    if (!token) return;

    const [masters, slaves] = await Promise.all([
      db
        .select({
          id: masterAccountsTable.id,
          metaapiAccountId: masterAccountsTable.metaapiAccountId,
          status: masterAccountsTable.status,
          userId: masterAccountsTable.userId,
          broker: masterAccountsTable.broker,
          mt5Login: masterAccountsTable.mt5Login,
          copyFactoryProviderStatus: masterAccountsTable.copyFactoryProviderStatus,
        })
        .from(masterAccountsTable)
        .where(
          and(
            inArray(masterAccountsTable.status, ADVANCING_STATUSES),
            isNotNull(masterAccountsTable.metaapiAccountId)
          )
        ),
      db
        .select({
          id: slaveAccountsTable.id,
          metaapiAccountId: slaveAccountsTable.metaapiAccountId,
          copyFactorySubscriberId: slaveAccountsTable.copyFactorySubscriberId,
        })
        .from(slaveAccountsTable)
        .where(
          and(
            inArray(slaveAccountsTable.status, SLAVE_NON_TERMINAL_STATUSES),
            isNotNull(slaveAccountsTable.metaapiAccountId)
          )
        ),
    ]);

    // Also pick up any already-connected slaves that never got a CopyFactory subscriber registration.
    const unregisteredConnected = await db
      .select({ id: slaveAccountsTable.id })
      .from(slaveAccountsTable)
      .where(
        and(
          eq(slaveAccountsTable.status, "connected"),
          isNull(slaveAccountsTable.copyFactorySubscriberId),
          isNotNull(slaveAccountsTable.metaapiAccountId)
        )
      );

    const total = masters.length + slaves.length + unregisteredConnected.length;
    if (total === 0) return;

    pollCount++;
    logger.info(
      { poll: pollCount, masters: masters.length, slaves: slaves.length, unregisteredConnected: unregisteredConnected.length },
      "Account poller tick started"
    );

    for (let i = 0; i < masters.length; i += CONCURRENCY) {
      const chunk = masters.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map((a) =>
          advanceMasterAccount(
            a.id,
            a.metaapiAccountId!,
            a.status,
            a.userId,
            token,
            a.broker,
            a.mt5Login,
            a.copyFactoryProviderStatus ?? null
          )
        )
      );
    }

    for (let i = 0; i < slaves.length; i += CONCURRENCY) {
      const chunk = slaves.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map((a) => checkSingleSlaveAccount(a.id, a.metaapiAccountId!, token, a.copyFactorySubscriberId ?? null))
      );
    }

    // Fire-and-forget CopyFactory registration + auto-bind for connected unregistered slaves.
    for (const slave of unregisteredConnected) {
      if (cfRegistrationInProgress.has(slave.id)) continue;
      cfRegistrationInProgress.add(slave.id);
      logger.info({ slaveId: slave.id }, "Auto-repair: connected slave missing CopyFactory subscriber registration");
      ensureSlaveSubscriberRole(slave.id)
        .then(() => autoBindSlaveAccount(slave.id))
        .catch((err) => logger.warn({ slaveId: slave.id, err }, "Auto-repair CopyFactory subscriber registration/auto-bind failed"))
        .finally(() => cfRegistrationInProgress.delete(slave.id));
    }

    // Recovery: connected slaves that are registered as CF subscribers but have no active bindings.
    // This handles the case where a strategy was created after the slave became connected.
    const connectedRegistered = await db
      .select({ id: slaveAccountsTable.id })
      .from(slaveAccountsTable)
      .where(
        and(
          eq(slaveAccountsTable.status, "connected"),
          isNotNull(slaveAccountsTable.copyFactorySubscriberId),
          isNotNull(slaveAccountsTable.metaapiAccountId)
        )
      );

    if (connectedRegistered.length > 0) {
      const activeBindingsRows = await db
        .select({ slaveAccountId: bindingsTable.slaveAccountId })
        .from(bindingsTable)
        .where(eq(bindingsTable.status, "active"));

      const boundSlaveIds = new Set(activeBindingsRows.map((b) => b.slaveAccountId));
      const needingBind = connectedRegistered.filter((s) => !boundSlaveIds.has(s.id));

      for (const slave of needingBind) {
        if (cfAutoBindInProgress.has(slave.id)) continue;
        cfAutoBindInProgress.add(slave.id);
        logger.info({ slaveId: slave.id }, "Auto-bind recovery: connected subscriber missing active bindings");
        autoBindSlaveAccount(slave.id)
          .catch((err) => logger.warn({ slaveId: slave.id, err }, "Auto-bind recovery failed"))
          .finally(() => cfAutoBindInProgress.delete(slave.id));
      }
    }

    logger.info(
      { poll: pollCount, masters: masters.length, slaves: slaves.length, durationMs: Date.now() - startedAt },
      "Account poller tick finished"
    );
  } catch (err) {
    pollerFailed = true;
    workerTickFailed("account-poller", err instanceof Error ? err.message : String(err), pollerStartedAt);
    logger.error({ err }, "Account poller tick failed");
  } finally {
    if (!pollerFailed) {
      workerTickComplete("account-poller", { startedAt: pollerStartedAt, jobsProcessed: pollCount, errors: [] });
    }
    pollerRunning = false;
  }
}

// ── 5-minute health monitor tick ──────────────────────────────────────────────

async function runMonitorTick(): Promise<void> {
  if (monitorRunning) {
    logger.debug("Health monitor tick skipped — previous run still in progress");
    return;
  }
  monitorRunning = true;
  const startedAt = Date.now();
  const monitorStartedAt = new Date().toISOString();
  workerTickStart("health-monitor");
  let monitorFailed = false;
  try {
    const token = await getMetaApiToken();
    if (!token) return;

    const masters = await db
      .select({
        id: masterAccountsTable.id,
        metaapiAccountId: masterAccountsTable.metaapiAccountId,
        status: masterAccountsTable.status,
        userId: masterAccountsTable.userId,
        broker: masterAccountsTable.broker,
        mt5Login: masterAccountsTable.mt5Login,
        copyFactoryProviderStatus: masterAccountsTable.copyFactoryProviderStatus,
      })
      .from(masterAccountsTable)
      .where(
        and(
          inArray(masterAccountsTable.status, MONITOR_STATUSES),
          isNotNull(masterAccountsTable.metaapiAccountId)
        )
      );

    if (masters.length === 0) return;

    monitorCount++;
    logger.info(
      { monitor: monitorCount, accounts: masters.length },
      "Health monitor tick started"
    );

    for (let i = 0; i < masters.length; i += CONCURRENCY) {
      const chunk = masters.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map((a) =>
          monitorMasterAccount(a.id, a.metaapiAccountId!, a.status, a.userId, token)
        )
      );
    }

    // Catch existing active/suspended accounts that were deployed before provider registration existed
    for (const a of masters) {
      if (a.copyFactoryProviderStatus !== "registered") {
        await ensureProviderRegistered(a.id, a.metaapiAccountId!, a.broker, a.mt5Login, a.copyFactoryProviderStatus ?? null);
      }
    }

    logger.info(
      { monitor: monitorCount, accounts: masters.length, durationMs: Date.now() - startedAt },
      "Health monitor tick finished"
    );
  } catch (err) {
    monitorFailed = true;
    workerTickFailed("health-monitor", err instanceof Error ? err.message : String(err), monitorStartedAt);
    logger.error({ err }, "Health monitor tick failed");
  } finally {
    if (!monitorFailed) {
      workerTickComplete("health-monitor", { startedAt: monitorStartedAt, jobsProcessed: monitorCount, errors: [] });
    }
    monitorRunning = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startAccountPoller(): void {
  registerWorker({
    id: "account-poller",
    name: "MetaApi Account Poller",
    description: "Advances account lifecycle states (deploying → connecting → active) — runs every 30 seconds",
    intervalMs: POLL_INTERVAL_MS,
    staleThresholdMs: 3 * 60_000,
    restartFn: () => { void runPollerNow(); },
  });
  registerWorker({
    id: "health-monitor",
    name: "MetaApi Health Monitor",
    description: "Monitors active/suspended master accounts for connection loss — runs every 5 minutes",
    intervalMs: MONITOR_INTERVAL_MS,
    staleThresholdMs: 20 * 60_000,
    restartFn: () => { void runMonitorTick(); },
  });

  setInterval(() => { void runPollerTick(); }, POLL_INTERVAL_MS);
  setInterval(() => { void runMonitorTick(); }, MONITOR_INTERVAL_MS);
  logger.info(
    { pollIntervalMs: POLL_INTERVAL_MS, monitorIntervalMs: MONITOR_INTERVAL_MS, concurrency: CONCURRENCY },
    "MetaApi account poller and health monitor started"
  );
  void runPollerTick();
  void runMonitorTick();
}

export async function runPollerNow(): Promise<void> {
  await runPollerTick();
}
