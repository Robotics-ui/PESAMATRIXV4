import { eq, sql } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, adminSettingsTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

export async function seedDefaultAccounts(): Promise<void> {
  try {
    // Seed admin_settings — exactly one row, never duplicate
    await db
      .insert(adminSettingsTable)
      .values({ dailyFee: "100", minDays: 1, maxDays: 365 })
      .onConflictDoNothing();

    // Delete any accidental extra rows, keep only the lowest id
    await db.execute(
      sql`DELETE FROM admin_settings WHERE id NOT IN (SELECT MIN(id) FROM admin_settings)`
    );

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, "admin@pesamatrix.com"));
    if (existing.length > 0) return;

    const adminHash = await hashPassword("Admin@2024!");
    const [admin] = await db
      .insert(usersTable)
      .values({ name: "Admin", email: "admin@pesamatrix.com", phone: "254700000000", role: "admin", status: "active", passwordHash: adminHash })
      .returning();

    await db.insert(subscriptionsTable).values({ userId: admin.id, status: "expired", daysPaid: 0 });

    const traderHash = await hashPassword("Trader@2024!");
    const [trader] = await db
      .insert(usersTable)
      .values({ name: "Demo Trader", email: "trader@pesamatrix.com", phone: "254700000001", role: "user", status: "active", passwordHash: traderHash })
      .returning();

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    await db.insert(subscriptionsTable).values({ userId: trader.id, status: "active", startDate: new Date(), endDate, daysPaid: 5 });

    logger.info("Default accounts seeded (admin + demo trader)");
  } catch (err) {
    logger.error({ err }, "Failed to seed default accounts");
  }
}
