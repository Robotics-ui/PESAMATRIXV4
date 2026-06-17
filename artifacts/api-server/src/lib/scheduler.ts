import cron from "node-cron";
import { eq, inArray, lt } from "drizzle-orm";
import { db, subscriptionsTable, slaveAccountsTable, bindingsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Auto-suspension scheduler.
 * Runs every 30 minutes. Checks all active subscriptions.
 * If a subscription has expired (endDate passed), mark it expired
 * and suspend all associated slave account bindings.
 */
export function startScheduler(): void {
  cron.schedule("*/30 * * * *", async () => {
    try {
      logger.info("Running subscription expiry check...");
      const now = new Date();

      // Find all active subscriptions that have expired
      const expiredSubs = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.status, "active"));

      const toExpire = expiredSubs.filter(
        (s) => s.endDate != null && s.endDate <= now
      );

      if (toExpire.length === 0) {
        logger.info("No expired subscriptions found");
        return;
      }

      logger.info({ count: toExpire.length }, "Expiring subscriptions");

      for (const sub of toExpire) {
        // Mark subscription as expired
        await db
          .update(subscriptionsTable)
          .set({ status: "expired" })
          .where(eq(subscriptionsTable.id, sub.id));

        // Get all slave accounts for this user
        const slaveAccounts = await db
          .select()
          .from(slaveAccountsTable)
          .where(eq(slaveAccountsTable.userId, sub.userId));

        const slaveIds = slaveAccounts.map((s) => s.id);

        if (slaveIds.length > 0) {
          // Suspend all bindings for these slave accounts
          await db
            .update(bindingsTable)
            .set({ status: "suspended" })
            .where(inArray(bindingsTable.slaveAccountId, slaveIds));

          logger.info(
            { userId: sub.userId, slaveCount: slaveIds.length },
            "Suspended bindings for expired subscription"
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in subscription expiry scheduler");
    }
  });

  logger.info("Subscription expiry scheduler started (every 30 minutes)");
}
