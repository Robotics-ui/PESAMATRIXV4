import { Router } from "express";
import { eq, desc, and, gte, count } from "drizzle-orm";
import {
  db,
  smsSettingsTable,
  smsTemplatesTable,
  smsQueueTable,
  smsLogsTable,
  notificationPreferencesTable,
  usersTable,
} from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { invalidateSmsSettingsCache, sendSmsNow, broadcastSms, seedDefaultTemplates } from "../lib/smsService";

const router = Router();

// ──────────────────────────────────────────────
// USER — Notification Preferences
// ──────────────────────────────────────────────

router.get("/sms/preferences", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [pref] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);

  if (!pref) {
    res.json({ userId, tradeAlerts: true, subscriptionAlerts: true, announcements: true });
    return;
  }
  res.json(pref);
});

router.put("/sms/preferences", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { tradeAlerts, subscriptionAlerts, announcements } = req.body as {
    tradeAlerts?: boolean;
    subscriptionAlerts?: boolean;
    announcements?: boolean;
  };

  const [existing] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);

  const updates: Record<string, boolean> = {};
  if (typeof tradeAlerts === "boolean") updates.tradeAlerts = tradeAlerts;
  if (typeof subscriptionAlerts === "boolean") updates.subscriptionAlerts = subscriptionAlerts;
  if (typeof announcements === "boolean") updates.announcements = announcements;

  if (existing) {
    await db.update(notificationPreferencesTable).set(updates).where(eq(notificationPreferencesTable.userId, userId));
  } else {
    await db.insert(notificationPreferencesTable).values({
      userId,
      tradeAlerts: updates.tradeAlerts ?? true,
      subscriptionAlerts: updates.subscriptionAlerts ?? true,
      announcements: updates.announcements ?? true,
    });
  }

  const [updated] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);

  res.json(updated ?? { userId, tradeAlerts: true, subscriptionAlerts: true, announcements: true });
});

// ──────────────────────────────────────────────
// ADMIN — SMS Settings
// ──────────────────────────────────────────────

router.get("/admin/sms/settings", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(smsSettingsTable).limit(1);
  if (!settings) {
    res.json({
      id: null,
      providerName: "",
      apiUrl: "",
      apiKey: "",
      apiSecret: "",
      senderId: "PESAMTRX",
      enabled: false,
    });
    return;
  }
  // Mask key and secret for display
  res.json({
    ...settings,
    apiKey: settings.apiKey ? "••••••••" + settings.apiKey.slice(-4) : "",
    apiSecret: settings.apiSecret ? "••••••••" + settings.apiSecret.slice(-4) : "",
  });
});

router.put("/admin/sms/settings", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { providerName, apiUrl, apiKey, apiSecret, senderId, enabled } = req.body as {
    providerName?: string;
    apiUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    enabled?: boolean;
  };

  const [existing] = await db.select().from(smsSettingsTable).limit(1);

  const updates: Record<string, unknown> = {};
  if (providerName !== undefined) updates.providerName = providerName;
  if (apiUrl !== undefined) updates.apiUrl = apiUrl;
  if (senderId !== undefined) updates.senderId = senderId;
  if (typeof enabled === "boolean") updates.enabled = enabled;
  // Only overwrite key/secret if not masked placeholder
  if (apiKey && !apiKey.startsWith("••••")) updates.apiKey = apiKey;
  if (apiSecret && !apiSecret.startsWith("••••")) updates.apiSecret = apiSecret;

  if (existing) {
    await db.update(smsSettingsTable).set(updates).where(eq(smsSettingsTable.id, existing.id));
  } else {
    await db.insert(smsSettingsTable).values({
      providerName: (providerName as string) ?? "",
      apiUrl: (apiUrl as string) ?? "",
      apiKey: (apiKey as string) ?? "",
      apiSecret: (apiSecret as string) ?? "",
      senderId: (senderId as string) ?? "PESAMTRX",
      enabled: (enabled as boolean) ?? false,
    });
  }

  invalidateSmsSettingsCache();
  res.json({ success: true });
});

router.post("/admin/sms/test", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { phone, message } = req.body as { phone: string; message?: string };
  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }
  const testMessage = message ?? "PESAMATRIX: This is a test SMS. If you received this, your SMS provider is configured correctly.";
  const result = await sendSmsNow(phone, testMessage);
  res.json(result);
});

// ──────────────────────────────────────────────
// ADMIN — SMS Templates
// ──────────────────────────────────────────────

router.get("/admin/sms/templates", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  await seedDefaultTemplates();
  const templates = await db.select().from(smsTemplatesTable).orderBy(smsTemplatesTable.eventType);
  res.json(templates);
});

router.put("/admin/sms/templates/:eventType", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { eventType } = req.params;
  const { template, enabled } = req.body as { template?: string; enabled?: boolean };

  const [existing] = await db
    .select()
    .from(smsTemplatesTable)
    .where(eq(smsTemplatesTable.eventType, eventType))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (template !== undefined) updates.template = template;
  if (typeof enabled === "boolean") updates.enabled = enabled;

  await db.update(smsTemplatesTable).set(updates).where(eq(smsTemplatesTable.eventType, eventType));
  const [updated] = await db.select().from(smsTemplatesTable).where(eq(smsTemplatesTable.eventType, eventType)).limit(1);
  res.json(updated);
});

// ──────────────────────────────────────────────
// ADMIN — SMS Queue
// ──────────────────────────────────────────────

router.get("/admin/sms/queue", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
  const offset = parseInt((req.query.offset as string) ?? "0", 10);

  const [items, [totalResult]] = await Promise.all([
    db
      .select()
      .from(smsQueueTable)
      .orderBy(desc(smsQueueTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(smsQueueTable),
  ]);

  res.json({ items, total: totalResult.count, limit, offset });
});

// ──────────────────────────────────────────────
// ADMIN — SMS Logs
// ──────────────────────────────────────────────

router.get("/admin/sms/logs", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
  const offset = parseInt((req.query.offset as string) ?? "0", 10);
  const status = req.query.status as string | undefined;
  const since = req.query.since as string | undefined;

  const conditions = [];
  if (status) conditions.push(eq(smsLogsTable.status, status));
  if (since) conditions.push(gte(smsLogsTable.createdAt, new Date(since)));

  const [items, [totalResult]] = await Promise.all([
    db
      .select({
        id: smsLogsTable.id,
        queueId: smsLogsTable.queueId,
        userId: smsLogsTable.userId,
        phone: smsLogsTable.phone,
        message: smsLogsTable.message,
        eventType: smsLogsTable.eventType,
        status: smsLogsTable.status,
        deliveryStatus: smsLogsTable.deliveryStatus,
        providerResponse: smsLogsTable.providerResponse,
        sentAt: smsLogsTable.sentAt,
        createdAt: smsLogsTable.createdAt,
      })
      .from(smsLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(smsLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(smsLogsTable).where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  res.json({ items, total: totalResult.count, limit, offset });
});

// ──────────────────────────────────────────────
// ADMIN — Broadcast SMS
// ──────────────────────────────────────────────

router.post("/admin/sms/broadcast", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { message, onlyActive = true } = req.body as { message: string; onlyActive?: boolean };
  if (!message || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const result = await broadcastSms({ message: message.trim(), onlyActive });
  res.json({ success: true, queued: result.queued });
});

// ──────────────────────────────────────────────
// ADMIN — Delivery Stats
// ──────────────────────────────────────────────

router.get("/admin/sms/stats", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [sentResult] = await db.select({ count: count() }).from(smsLogsTable).where(eq(smsLogsTable.status, "sent"));
  const [failedResult] = await db.select({ count: count() }).from(smsLogsTable).where(eq(smsLogsTable.status, "failed"));
  const [pendingResult] = await db.select({ count: count() }).from(smsQueueTable).where(eq(smsQueueTable.status, "pending"));
  const [totalResult] = await db.select({ count: count() }).from(smsLogsTable);

  res.json({
    total: totalResult.count,
    sent: sentResult.count,
    failed: failedResult.count,
    pending: pendingResult.count,
  });
});

export default router;
