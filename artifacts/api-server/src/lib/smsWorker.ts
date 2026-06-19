import cron from "node-cron";
import { processSmsQueue } from "./smsService";
import { logger } from "./logger";

let workerTask: cron.ScheduledTask | null = null;

export function startSmsWorker() {
  if (workerTask) return;

  // Run every minute
  workerTask = cron.schedule("* * * * *", async () => {
    try {
      await processSmsQueue(50, 10);
    } catch (err) {
      logger.error({ err }, "SMS queue worker error");
    }
  });

  const nextRun = new Date();
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  nextRun.setMinutes(nextRun.getMinutes() + 1);

  logger.info({ nextRunAt: nextRun.toISOString() }, "SMS queue worker started (every minute)");
}
