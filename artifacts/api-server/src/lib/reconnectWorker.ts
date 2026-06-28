import { inArray, isNotNull, and, eq } from "drizzle-orm";
import { db, masterAccountsTable, slaveAccountsTable } from "@workspace/db";
import { getMetaApiToken, callMetaApi } from "./metaapi";
import { logger } from "./logger";
import {
  registerWorker,
  workerTickStart,
  workerTickComplete,
  workerTickFailed,
} from "./workerRegistry";
import { RetryQueue } from "./retryQueue";

const PROVISIONING_API = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const RECONNECT_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

// ── Per-account retry queue ────────────────────────────────────────────────────

interface ReconnectJob {
  accountId: number;
  accountType: "master" | "slave";
  metaapiAccountId: string;
  label: string;
}

export const reconnectRetryQueue = new RetryQueue<ReconnectJob>(
  "reconnect-retry",
  async (job) => {
    const token = await getMetaApiToken();
    if (!token) throw new Error("MetaApi token unavailable");

    const result = await callMetaApi(
      "POST",
      `${PROVISIONING_API}/users/current/accounts/${job.metaapiAccountId}/deploy`,
      token
    );

    if (result.ok || result.status === 204) {
      logger.info({ ...job }, "reconnectRetryQueue: deploy retried successfully");
      if (job.accountType === "master") {
        await db.update(masterAccountsTable).set({ status: "deploying", lastErrorMessage: null }).where(eq(masterAccountsTable.id, job.accountId));
      } else {
        await db.update(slaveAccountsTable).set({ status: "deploying", lastErrorMessage: null }).where(eq(slaveAccountsTable.id, job.accountId));
      }
    } else {
      const body = result.data as { message?: string } | null;
      throw new Error(body?.message ?? `Deploy returned HTTP ${result.status}`);
    }
  },
  { baseDelayMs: 5_000 }
);

// ── 5-minute reconnect tick ───────────────────────────────────────────────────

async function runReconnectTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("reconnect-worker");
  let failed = false;
  let enqueued = 0;

  try {
    const token = await getMetaApiToken();
    if (!token) {
      workerTickComplete("reconnect-worker", { startedAt, jobsProcessed: 0, errors: [] });
      return;
    }

    const disconnectedMasters = await db
      .select({ id: masterAccountsTable.id, metaapiAccountId: masterAccountsTable.metaapiAccountId, mt5Login: masterAccountsTable.mt5Login })
      .from(masterAccountsTable)
      .where(and(
        inArray(masterAccountsTable.status, ["disconnected", "failed"]),
        isNotNull(masterAccountsTable.metaapiAccountId)
      ));

    const disconnectedSlaves = await db
      .select({ id: slaveAccountsTable.id, metaapiAccountId: slaveAccountsTable.metaapiAccountId, mt5Login: slaveAccountsTable.mt5Login })
      .from(slaveAccountsTable)
      .where(and(
        inArray(slaveAccountsTable.status, ["disconnected", "failed"]),
        isNotNull(slaveAccountsTable.metaapiAccountId)
      ));

    for (const acc of disconnectedMasters) {
      reconnectRetryQueue.enqueue(
        `master-${acc.id}`,
        `Master ${acc.mt5Login ?? acc.id} reconnect`,
        { accountId: acc.id, accountType: "master", metaapiAccountId: acc.metaapiAccountId!, label: `master-${acc.id}` },
        3
      );
      enqueued++;
    }

    for (const acc of disconnectedSlaves) {
      reconnectRetryQueue.enqueue(
        `slave-${acc.id}`,
        `Slave ${acc.mt5Login ?? acc.id} reconnect`,
        { accountId: acc.id, accountType: "slave", metaapiAccountId: acc.metaapiAccountId!, label: `slave-${acc.id}` },
        3
      );
      enqueued++;
    }

    if (enqueued > 0) {
      logger.info({ enqueued, masters: disconnectedMasters.length, slaves: disconnectedSlaves.length }, "Reconnect worker: accounts queued for reconnect");
    }

    workerTickComplete("reconnect-worker", { startedAt, jobsProcessed: enqueued, errors: [] });
  } catch (err) {
    failed = true;
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Reconnect worker tick failed");
    workerTickFailed("reconnect-worker", msg, startedAt);
  }

  void failed;
}

export function runReconnectNow(): void {
  void runReconnectTick();
}

export function startReconnectWorker(): void {
  registerWorker({
    id: "reconnect-worker",
    name: "MetaApi Reconnect Worker",
    description:
      "Queues disconnected/failed MetaApi accounts for reconnect with exponential backoff — runs every 5 minutes",
    intervalMs: RECONNECT_INTERVAL_MS,
    staleThresholdMs: STALE_THRESHOLD_MS,
    restartFn: runReconnectNow,
  });

  setInterval(() => { void runReconnectTick(); }, RECONNECT_INTERVAL_MS);

  logger.info({ intervalMs: RECONNECT_INTERVAL_MS }, "MetaApi reconnect worker started");
}
