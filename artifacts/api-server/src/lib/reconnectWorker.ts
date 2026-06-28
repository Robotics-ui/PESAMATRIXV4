import { inArray, isNotNull, and, or, isNull, lt, eq } from "drizzle-orm";
import { db, masterAccountsTable, slaveAccountsTable } from "@workspace/db";
import { getMetaApiToken, callMetaApi } from "./metaapi";
import { logger } from "./logger";
import {
  registerWorker,
  workerTickStart,
  workerTickComplete,
  workerTickFailed,
} from "./workerRegistry";

const PROVISIONING_API = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const RECONNECT_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 20 * 60 * 1000;
const STALE_ACCOUNT_THRESHOLD_MS = 10 * 60 * 1000;

async function attemptRedeploy(
  metaapiAccountId: string,
  token: string,
  label: string,
  updateStatus: (status: string, errMsg: string | null) => Promise<void>
): Promise<void> {
  try {
    const result = await callMetaApi(
      "POST",
      `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}/deploy`,
      token
    );
    if (result.ok || result.status === 204) {
      logger.info({ metaapiAccountId, label }, "Reconnect worker: deploy retried");
      await updateStatus("deploying", null);
    } else {
      const body = result.data as { message?: string } | null;
      const errMsg = body?.message ?? `Deploy HTTP ${result.status}`;
      logger.warn(
        { metaapiAccountId, label, httpStatus: result.status, body: result.data },
        "Reconnect worker: deploy retry returned non-OK"
      );
      await updateStatus("failed", `Retry failed: ${errMsg}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ metaapiAccountId, label, err }, "Reconnect worker: deploy retry error");
    await updateStatus("failed", `Retry error: ${msg}`);
  }
}

async function runReconnectTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("reconnect-worker");
  const errors: string[] = [];
  let actioned = 0;

  try {
    const token = await getMetaApiToken();
    if (!token) {
      workerTickComplete("reconnect-worker", { startedAt, jobsProcessed: 0, errors: [] });
      return;
    }

    const staleThreshold = new Date(Date.now() - STALE_ACCOUNT_THRESHOLD_MS);

    const disconnectedMasters = await db
      .select()
      .from(masterAccountsTable)
      .where(
        and(
          inArray(masterAccountsTable.status, ["disconnected"]),
          isNotNull(masterAccountsTable.metaapiAccountId),
          or(
            isNull(masterAccountsTable.lastCheckedAt),
            lt(masterAccountsTable.lastCheckedAt, staleThreshold)
          )
        )
      );

    const disconnectedSlaves = await db
      .select()
      .from(slaveAccountsTable)
      .where(
        and(
          inArray(slaveAccountsTable.status, ["disconnected"]),
          isNotNull(slaveAccountsTable.metaapiAccountId),
          or(
            isNull(slaveAccountsTable.lastCheckedAt),
            lt(slaveAccountsTable.lastCheckedAt, staleThreshold)
          )
        )
      );

    const failedMasters = await db
      .select()
      .from(masterAccountsTable)
      .where(
        and(
          inArray(masterAccountsTable.status, ["failed"]),
          isNotNull(masterAccountsTable.metaapiAccountId)
        )
      );

    const failedSlaves = await db
      .select()
      .from(slaveAccountsTable)
      .where(
        and(
          inArray(slaveAccountsTable.status, ["failed"]),
          isNotNull(slaveAccountsTable.metaapiAccountId)
        )
      );

    for (const acc of disconnectedMasters) {
      logger.info(
        { id: acc.id, metaapiAccountId: acc.metaapiAccountId },
        "Reconnect worker: retrying disconnected master"
      );
      try {
        await attemptRedeploy(acc.metaapiAccountId!, token, `master-${acc.id}`, async (s, e) => {
          await db
            .update(masterAccountsTable)
            .set({ status: s, lastErrorMessage: e })
            .where(eq(masterAccountsTable.id, acc.id));
        });
        actioned++;
      } catch (err) {
        errors.push(`master-${acc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const acc of disconnectedSlaves) {
      logger.info(
        { id: acc.id, metaapiAccountId: acc.metaapiAccountId },
        "Reconnect worker: retrying disconnected slave"
      );
      try {
        await attemptRedeploy(acc.metaapiAccountId!, token, `slave-${acc.id}`, async (s, e) => {
          await db
            .update(slaveAccountsTable)
            .set({ status: s, lastErrorMessage: e })
            .where(eq(slaveAccountsTable.id, acc.id));
        });
        actioned++;
      } catch (err) {
        errors.push(`slave-${acc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const acc of failedMasters) {
      logger.info(
        { id: acc.id, metaapiAccountId: acc.metaapiAccountId },
        "Reconnect worker: retrying FAILED master"
      );
      try {
        await attemptRedeploy(
          acc.metaapiAccountId!,
          token,
          `master-failed-${acc.id}`,
          async (s, e) => {
            await db
              .update(masterAccountsTable)
              .set({ status: s, lastErrorMessage: e })
              .where(eq(masterAccountsTable.id, acc.id));
          }
        );
        actioned++;
      } catch (err) {
        errors.push(`master-failed-${acc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const acc of failedSlaves) {
      logger.info(
        { id: acc.id, metaapiAccountId: acc.metaapiAccountId },
        "Reconnect worker: retrying FAILED slave"
      );
      try {
        await attemptRedeploy(
          acc.metaapiAccountId!,
          token,
          `slave-failed-${acc.id}`,
          async (s, e) => {
            await db
              .update(slaveAccountsTable)
              .set({ status: s, lastErrorMessage: e })
              .where(eq(slaveAccountsTable.id, acc.id));
          }
        );
        actioned++;
      } catch (err) {
        errors.push(`slave-failed-${acc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const totalActioned =
      disconnectedMasters.length +
      disconnectedSlaves.length +
      failedMasters.length +
      failedSlaves.length;

    if (totalActioned > 0) {
      logger.info(
        {
          reconnectedDisconnected:
            disconnectedMasters.length + disconnectedSlaves.length,
          retriedFailed: failedMasters.length + failedSlaves.length,
        },
        "Reconnect worker tick completed"
      );
    }

    workerTickComplete("reconnect-worker", {
      startedAt,
      jobsProcessed: actioned,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Reconnect worker tick failed");
    workerTickFailed("reconnect-worker", msg, startedAt);
  }
}

export function runReconnectNow(): void {
  void runReconnectTick();
}

export function startReconnectWorker(): void {
  registerWorker({
    id: "reconnect-worker",
    name: "MetaApi Reconnect Worker",
    description:
      "Retries disconnected/failed MetaApi accounts by redeploying them — runs every 5 minutes",
    intervalMs: RECONNECT_INTERVAL_MS,
    staleThresholdMs: STALE_THRESHOLD_MS,
    restartFn: runReconnectNow,
  });

  setInterval(() => {
    void runReconnectTick();
  }, RECONNECT_INTERVAL_MS);

  logger.info(
    { intervalMs: RECONNECT_INTERVAL_MS },
    "MetaApi reconnect worker started"
  );
}
