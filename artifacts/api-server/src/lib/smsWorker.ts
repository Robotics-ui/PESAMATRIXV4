import cron, { type ScheduledTask } from "node-cron";
import { processSmsQueue } from "./smsService";
import { logger } from "./logger";
import {
  registerWorker,
  workerTickStart,
  workerTickComplete,
  workerTickFailed,
} from "./workerRegistry";

const INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 5 * 60_000;

let workerTask: ScheduledTask | null = null;

export function triggerSmsWorkerNow(): void {
  void (async () => {
    const startedAt = new Date().toISOString();
    workerTickStart("sms-worker");
    try {
      await processSmsQueue(50, 10);
      workerTickComplete("sms-worker", { startedAt, jobsProcessed: 1, errors: [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "SMS queue worker error (manual trigger)");
      workerTickFailed("sms-worker", msg, startedAt);
    }
  })();
}

export function startSmsWorker() {
  if (workerTask) return;

  registerWorker({
    id: "sms-worker",
    name: "SMS Queue Worker",
    description: "Processes the outbound SMS queue — runs every minute",
    intervalMs: INTERVAL_MS,
    staleThresholdMs: STALE_THRESHOLD_MS,
    restartFn: triggerSmsWorkerNow,
  });

  workerTask = cron.schedule("* * * * *", async () => {
    const startedAt = new Date().toISOString();
    workerTickStart("sms-worker");
    try {
      await processSmsQueue(50, 10);
      workerTickComplete("sms-worker", { startedAt, jobsProcessed: 1, errors: [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "SMS queue worker error");
      workerTickFailed("sms-worker", msg, startedAt);
    }
  });

  logger.info("SMS queue worker running every minute");

  const nextRun = new Date();
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  nextRun.setMinutes(nextRun.getMinutes() + 1);

  logger.info(
    { nextRunAt: nextRun.toISOString() },
    "SMS queue worker started (every minute)"
  );
}
