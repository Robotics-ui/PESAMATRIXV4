import { eq } from "drizzle-orm";
import { db, strategiesTable, masterAccountsTable } from "@workspace/db";
import { getMetaApiToken, callMetaApi } from "./metaapi";
import { logger } from "./logger";

const COPYFACTORY_API = "https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai";

export type CopyFactoryStrategyRecord = {
  _id: string;
  name: string;
  positionLifecycle?: string;
  connectionId?: string;
};

export type StrategySyncEntry = {
  copyfactoryStrategyId: string;
  name: string;
  localId: number | null;
  isNew: boolean;
};

export type StrategySyncReport = {
  syncedAt: string;
  durationMs: number;
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
  strategies: StrategySyncEntry[];
};

let lastReport: StrategySyncReport | null = null;

export function getLastSyncReport(): StrategySyncReport | null {
  return lastReport;
}

export async function fetchCopyFactoryStrategies(): Promise<CopyFactoryStrategyRecord[]> {
  const token = await getMetaApiToken();
  if (!token) {
    logger.debug("No MetaApi token — skipping CopyFactory strategy fetch");
    return [];
  }

  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    const result = await callMetaApi<CopyFactoryStrategyRecord[]>(
      "GET",
      `${COPYFACTORY_API}/users/current/configuration/strategies`,
      token
    );
    if (!result.ok) {
      logger.warn({ status: result.status, body: result.data }, "CopyFactory GET strategies returned non-OK");
      return [];
    }
    const data = result.data;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.error({ err }, "CopyFactory strategy fetch network error");
    return [];
  } finally {
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
  }
}

export async function syncCopyFactoryStrategies(): Promise<StrategySyncReport> {
  const startedAt = Date.now();
  const report: StrategySyncReport = {
    syncedAt: new Date().toISOString(),
    durationMs: 0,
    fetched: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: [],
    strategies: [],
  };

  try {
    const cfStrategies = await fetchCopyFactoryStrategies();
    report.fetched = cfStrategies.length;

    const dbStrategies = await db.select().from(strategiesTable);
    const dbByCfId = new Map(
      dbStrategies
        .filter((s) => s.copyfactoryStrategyId)
        .map((s) => [s.copyfactoryStrategyId!, s])
    );

    const allMasters = await db.select().from(masterAccountsTable);
    const masterByMetaApiId = new Map(
      allMasters
        .filter((m) => m.metaapiAccountId)
        .map((m) => [m.metaapiAccountId!, m])
    );

    const cfStrategyIds = new Set(cfStrategies.map((s) => s._id));

    for (const cfStrategy of cfStrategies) {
      try {
        const existing = dbByCfId.get(cfStrategy._id);

        if (existing) {
          if (existing.strategyName !== cfStrategy.name || existing.status === "inactive") {
            await db
              .update(strategiesTable)
              .set({ strategyName: cfStrategy.name, status: "active" })
              .where(eq(strategiesTable.id, existing.id));
            report.updated++;
            logger.info({ localId: existing.id, cfId: cfStrategy._id }, "CopyFactory strategy updated in DB");
          }
          report.strategies.push({
            copyfactoryStrategyId: cfStrategy._id,
            name: cfStrategy.name,
            localId: existing.id,
            isNew: false,
          });
        } else {
          const master = cfStrategy.connectionId
            ? masterByMetaApiId.get(cfStrategy.connectionId)
            : null;

          if (!master) {
            const msg = `Strategy ${cfStrategy._id} ("${cfStrategy.name}") has no matching master account (connectionId: ${cfStrategy.connectionId ?? "none"}) — skipped`;
            report.errors.push(msg);
            logger.warn({ cfId: cfStrategy._id, connectionId: cfStrategy.connectionId }, msg);
            report.strategies.push({
              copyfactoryStrategyId: cfStrategy._id,
              name: cfStrategy.name,
              localId: null,
              isNew: true,
            });
            continue;
          }

          const [created] = await db
            .insert(strategiesTable)
            .values({
              userId: master.userId,
              copyfactoryStrategyId: cfStrategy._id,
              strategyName: cfStrategy.name,
              masterAccountId: master.id,
              status: "active",
            })
            .returning();

          report.created++;
          logger.info({ localId: created.id, cfId: cfStrategy._id }, "CopyFactory strategy imported into DB");
          report.strategies.push({
            copyfactoryStrategyId: cfStrategy._id,
            name: cfStrategy.name,
            localId: created.id,
            isNew: true,
          });
        }
      } catch (err) {
        const msg = `Failed to sync strategy ${cfStrategy._id}: ${String(err)}`;
        report.errors.push(msg);
        logger.error({ err, cfId: cfStrategy._id }, msg);
      }
    }

    for (const dbStrategy of dbStrategies) {
      if (
        dbStrategy.copyfactoryStrategyId &&
        !cfStrategyIds.has(dbStrategy.copyfactoryStrategyId) &&
        dbStrategy.status === "active"
      ) {
        try {
          await db
            .update(strategiesTable)
            .set({ status: "inactive" })
            .where(eq(strategiesTable.id, dbStrategy.id));
          report.deactivated++;
          logger.info(
            { localId: dbStrategy.id, cfId: dbStrategy.copyfactoryStrategyId },
            "Strategy marked inactive — no longer in CopyFactory"
          );
        } catch (err) {
          report.errors.push(`Failed to deactivate strategy ${dbStrategy.id}: ${String(err)}`);
        }
      }
    }
  } catch (err) {
    const msg = `Fatal sync error: ${String(err)}`;
    report.errors.push(msg);
    logger.error({ err }, "CopyFactory strategy sync fatal error");
  }

  report.durationMs = Date.now() - startedAt;
  lastReport = report;
  logger.info(
    {
      fetched: report.fetched,
      created: report.created,
      updated: report.updated,
      deactivated: report.deactivated,
      errors: report.errors.length,
    },
    "CopyFactory strategy sync complete"
  );
  return report;
}
