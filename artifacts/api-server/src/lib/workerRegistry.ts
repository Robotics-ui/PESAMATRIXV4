import { logger } from "./logger";

export type WorkerStatus = "idle" | "running" | "failed" | "restarting";

export interface WorkerRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jobsProcessed: number;
  errors: string[];
  success: boolean;
}

export interface WorkerState {
  id: string;
  name: string;
  description: string;
  status: WorkerStatus;
  intervalMs: number;
  staleThresholdMs: number;
  registeredAt: string;
  lastTickAt: string | null;
  lastJobCompletedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: number;
  restartCount: number;
  maxRestarts: number;
  isStale: boolean;
  recentRuns: WorkerRun[];
}

interface WorkerEntry extends WorkerState {
  restartFn?: () => void;
}

const MAX_RECENT_RUNS = 20;
const WATCHDOG_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

const registry = new Map<string, WorkerEntry>();

// ── Registration ──────────────────────────────────────────────────────────────

export function registerWorker(config: {
  id: string;
  name: string;
  description: string;
  intervalMs: number;
  staleThresholdMs: number;
  maxRestarts?: number;
  restartFn?: () => void;
}): void {
  registry.set(config.id, {
    id: config.id,
    name: config.name,
    description: config.description,
    status: "idle",
    intervalMs: config.intervalMs,
    staleThresholdMs: config.staleThresholdMs,
    registeredAt: new Date().toISOString(),
    lastTickAt: null,
    lastJobCompletedAt: null,
    lastErrorAt: null,
    lastError: null,
    consecutiveFailures: 0,
    jobsTotal: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    restartCount: 0,
    maxRestarts: config.maxRestarts ?? 10,
    isStale: false,
    recentRuns: [],
    restartFn: config.restartFn,
  });
}

// ── Lifecycle hooks called by workers ─────────────────────────────────────────

export function workerTickStart(id: string): void {
  const w = registry.get(id);
  if (!w) return;
  w.status = "running";
  w.lastTickAt = new Date().toISOString();
}

export function workerTickComplete(
  id: string,
  run: { startedAt: string; jobsProcessed: number; errors: string[] }
): void {
  const w = registry.get(id);
  if (!w) return;
  const now = new Date();
  const success = run.errors.length === 0;

  w.jobsTotal++;
  w.lastJobCompletedAt = now.toISOString();

  if (success) {
    w.jobsSucceeded++;
    w.consecutiveFailures = 0;
    w.status = "idle";
  } else {
    w.jobsFailed++;
    w.consecutiveFailures++;
    w.lastErrorAt = now.toISOString();
    w.lastError = run.errors[run.errors.length - 1] ?? "Unknown error";
    w.status =
      w.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? "failed" : "idle";
  }

  const runLog: WorkerRun = {
    startedAt: run.startedAt,
    finishedAt: now.toISOString(),
    durationMs: now.getTime() - new Date(run.startedAt).getTime(),
    jobsProcessed: run.jobsProcessed,
    errors: run.errors,
    success,
  };
  w.recentRuns = [runLog, ...w.recentRuns].slice(0, MAX_RECENT_RUNS);
}

export function workerTickFailed(
  id: string,
  error: string,
  startedAt: string
): void {
  const w = registry.get(id);
  if (!w) return;
  const now = new Date();

  w.jobsTotal++;
  w.jobsFailed++;
  w.consecutiveFailures++;
  w.lastErrorAt = now.toISOString();
  w.lastError = error;
  w.status =
    w.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? "failed" : "idle";

  const runLog: WorkerRun = {
    startedAt,
    finishedAt: now.toISOString(),
    durationMs: now.getTime() - new Date(startedAt).getTime(),
    jobsProcessed: 0,
    errors: [error],
    success: false,
  };
  w.recentRuns = [runLog, ...w.recentRuns].slice(0, MAX_RECENT_RUNS);

  if (w.status === "failed") {
    logger.warn(
      { workerId: id, consecutiveFailures: w.consecutiveFailures },
      "Worker marked as failed after consecutive failures"
    );
  }
}

// ── Stale detection ───────────────────────────────────────────────────────────

function computeIsStale(w: WorkerEntry): boolean {
  if (w.status === "running" || w.status === "restarting") return false;
  const checkTime = w.lastJobCompletedAt ?? w.registeredAt;
  return Date.now() - new Date(checkTime).getTime() > w.staleThresholdMs;
}

// ── Query API ─────────────────────────────────────────────────────────────────

export function getAllWorkers(): WorkerState[] {
  return Array.from(registry.values()).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    status: w.status,
    intervalMs: w.intervalMs,
    staleThresholdMs: w.staleThresholdMs,
    registeredAt: w.registeredAt,
    lastTickAt: w.lastTickAt,
    lastJobCompletedAt: w.lastJobCompletedAt,
    lastErrorAt: w.lastErrorAt,
    lastError: w.lastError,
    consecutiveFailures: w.consecutiveFailures,
    jobsTotal: w.jobsTotal,
    jobsSucceeded: w.jobsSucceeded,
    jobsFailed: w.jobsFailed,
    restartCount: w.restartCount,
    maxRestarts: w.maxRestarts,
    isStale: computeIsStale(w),
    recentRuns: w.recentRuns,
  }));
}

export function getWorkerById(id: string): WorkerState | null {
  const w = registry.get(id);
  if (!w) return null;
  return { ...getAllWorkers().find((x) => x.id === id)! };
}

export function manualRestartWorker(id: string): boolean {
  const w = registry.get(id);
  if (!w || !w.restartFn) return false;

  w.status = "restarting";
  w.consecutiveFailures = 0;
  w.restartCount++;

  try {
    w.restartFn();
    w.status = "idle";
    logger.info({ workerId: id }, "Worker manually restarted");
    return true;
  } catch (err) {
    w.status = "failed";
    w.lastError = `Manual restart failed: ${err instanceof Error ? err.message : String(err)}`;
    logger.error({ workerId: id, err }, "Worker manual restart failed");
    return false;
  }
}

// ── Watchdog — auto-restart failed workers ────────────────────────────────────

function runWatchdog(): void {
  for (const [id, w] of registry.entries()) {
    // Alert on stale workers
    if (computeIsStale(w) && w.status === "idle") {
      const staleMinutes = Math.floor(
        (Date.now() - new Date(w.lastJobCompletedAt ?? w.registeredAt).getTime()) / 60_000
      );
      logger.warn(
        { workerId: id, staleMinutes },
        "Watchdog: worker is stale — no job processed within threshold"
      );
    }

    // Auto-restart failed workers that have a restart function
    if (
      w.status === "failed" &&
      w.restartFn &&
      w.restartCount < w.maxRestarts
    ) {
      logger.info(
        { workerId: id, restartCount: w.restartCount, maxRestarts: w.maxRestarts },
        "Watchdog: auto-restarting failed worker"
      );
      w.status = "restarting";
      w.restartCount++;
      w.consecutiveFailures = 0;

      try {
        w.restartFn();
        w.status = "idle";
        logger.info({ workerId: id }, "Watchdog: worker auto-restarted successfully");
      } catch (err) {
        w.status = "failed";
        w.lastError = `Auto-restart failed: ${err instanceof Error ? err.message : String(err)}`;
        logger.error({ workerId: id, err }, "Watchdog: worker auto-restart failed");
      }
    } else if (w.status === "failed" && w.restartCount >= w.maxRestarts) {
      logger.error(
        { workerId: id, restartCount: w.restartCount },
        "Watchdog: worker exhausted max restarts — manual intervention required"
      );
    }
  }
}

export function startWorkerWatchdog(): void {
  setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);
  logger.info({ intervalMs: WATCHDOG_INTERVAL_MS }, "Worker watchdog started");
}

// ── Summary stats ─────────────────────────────────────────────────────────────

export function getWorkerSummary() {
  const workers = getAllWorkers();
  return {
    total: workers.length,
    running: workers.filter((w) => w.status === "running").length,
    idle: workers.filter((w) => w.status === "idle" && !w.isStale).length,
    failed: workers.filter((w) => w.status === "failed").length,
    restarting: workers.filter((w) => w.status === "restarting").length,
    stale: workers.filter((w) => w.isStale).length,
  };
}
