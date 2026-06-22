import { Router } from "express";
import { eq, and, asc, desc, ilike, or, sql } from "drizzle-orm";
import { db, faqsTable, faqSearchLogsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

const INITIAL_FAQS: Array<{
  question: string; answer: string; category: string; sortOrder: number; status: string;
}> = [
  {
    question: "What is PesaMatrix?",
    answer: "PesaMatrix is a cloud-to-cloud copy trading platform that allows subscribers to automatically copy trades from approved master traders. Your funds remain in your own MT5 account — PesaMatrix never holds or manages your money directly.",
    category: "Getting Started", sortOrder: 1, status: "published",
  },
  {
    question: "Do I need to transfer my money to PesaMatrix?",
    answer: "No. Your funds remain in your own MT5 trading account at all times. PesaMatrix only mirrors trade signals from master accounts to your account using MetaApi's cloud-to-cloud connection. You retain full control of your funds.",
    category: "Getting Started", sortOrder: 2, status: "published",
  },
  {
    question: "How does the 2-day free trial work?",
    answer: "New users receive a one-time 2-day free trial after verifying their phone number during registration. The trial activates immediately upon OTP verification and gives you full access to copy trading for 2 trading days. The trial cannot be reused on another account.",
    category: "Getting Started", sortOrder: 3, status: "published",
  },
  {
    question: "How do I get started on PesaMatrix?",
    answer: "1. Register and verify your phone number to activate your free trial. 2. Add a slave account (your MT5 follower account). 3. Create a strategy linked to a master account. 4. Create a binding to connect your slave account to the strategy. Copy trading starts immediately once your binding is active.",
    category: "Getting Started", sortOrder: 4, status: "published",
  },
  {
    question: "What happens when my subscription expires?",
    answer: "Your account is automatically unbound from copy trading and will stop receiving new copied trades. All active bindings are suspended. You can resubscribe at any time via M-Pesa STK Push and your bindings will be reactivated.",
    category: "Subscriptions", sortOrder: 1, status: "published",
  },
  {
    question: "What is the minimum subscription period?",
    answer: "The minimum subscription is 1 trading day. Subscription duration is counted in trading days (Monday to Friday, excluding weekends). You can subscribe for as many trading days as you wish, up to the platform maximum.",
    category: "Subscriptions", sortOrder: 2, status: "published",
  },
  {
    question: "How do I renew my subscription?",
    answer: "Go to the Subscribe page and enter the number of trading days you want to pay for. Enter your M-Pesa number and submit. You will receive an STK Push prompt on your phone — approve the payment and your subscription will be extended automatically.",
    category: "Payments", sortOrder: 1, status: "published",
  },
  {
    question: "What payment methods are supported?",
    answer: "PesaMatrix currently supports M-Pesa STK Push as the primary payment method. Enter your Safaricom M-Pesa number on the Subscribe page, confirm the push prompt on your phone, and your subscription is activated within seconds.",
    category: "M-Pesa", sortOrder: 1, status: "published",
  },
  {
    question: "What do I do if the M-Pesa STK Push does not arrive?",
    answer: "First ensure your phone has network coverage and is not on Do Not Disturb mode. Check that you entered the correct Safaricom number. Wait up to 60 seconds, then try again. If the issue persists, contact support with your transaction reference number.",
    category: "M-Pesa", sortOrder: 2, status: "published",
  },
  {
    question: "How do I become a master trader?",
    answer: "Submit a master account application from the Master Accounts page. Your account will go through a review and approval process by the platform admin. Once approved and deployed via MetaApi, your trades can be copied by subscribers through a strategy.",
    category: "Master Accounts", sortOrder: 1, status: "published",
  },
  {
    question: "Can I use multiple MT5 accounts?",
    answer: "Each subscription plan is tied to one approved MT5 slave account. If you need to copy into multiple accounts, contact support. Note that the same MT5 login cannot be used across multiple user accounts during a free trial to prevent abuse.",
    category: "Slave Accounts", sortOrder: 1, status: "published",
  },
  {
    question: "What does the investor password do?",
    answer: "The investor (read-only) password gives MetaApi view-only access to your MT5 account for signal replication. It cannot place trades, withdraw funds, or modify your account settings. It is safe to share for copy trading purposes.",
    category: "Slave Accounts", sortOrder: 2, status: "published",
  },
  {
    question: "Does PesaMatrix guarantee profits?",
    answer: "No. Forex and CFD trading carries significant risk and past performance does not guarantee future results. PesaMatrix is a technology platform that facilitates trade copying — it does not provide financial advice or guarantee any returns.",
    category: "Copy Trading", sortOrder: 1, status: "published",
  },
  {
    question: "What is a risk multiplier in bindings?",
    answer: "The risk multiplier controls how much of the master's lot size is copied to your account. 1.0 copies the exact same lot size. 0.5 copies half the lots (lower risk). 2.0 copies double the lots (higher risk). Start at 1.0 if you are unsure.",
    category: "Copy Trading", sortOrder: 2, status: "published",
  },
  {
    question: "Why is my account showing Connecting?",
    answer: "This usually means MetaApi is still deploying or synchronizing your trading account. The process can take 1–5 minutes depending on your broker and server. The status refreshes automatically every 10 seconds. If it stays in Connecting for more than 10 minutes, check your investor password and server name.",
    category: "MetaApi Connection", sortOrder: 1, status: "published",
  },
  {
    question: "How long does MetaApi connection take?",
    answer: "Most accounts connect within 1–3 minutes. Some brokers with slower servers may take up to 5 minutes. If your account stays in Deploying or Connecting for more than 10 minutes, verify your credentials, broker name, and server name, then try refreshing the status.",
    category: "MetaApi Connection", sortOrder: 2, status: "published",
  },
  {
    question: "How do I refer a friend to PesaMatrix?",
    answer: "Go to the Referrals page to find your unique referral link or code. Share it with friends. When they register and make their first payment, you earn referral credit that can be applied to your subscription.",
    category: "Promotions & Referrals", sortOrder: 1, status: "published",
  },
  {
    question: "Is my trading account safe with PesaMatrix?",
    answer: "Yes. PesaMatrix connects via MetaApi using your investor (read-only) password — it cannot place unauthorised trades or withdraw funds. Your master trading password is never required. All data is transmitted over encrypted connections.",
    category: "Security", sortOrder: 1, status: "published",
  },
  {
    question: "How do I contact support?",
    answer: "Go to the Contacts page within the platform to find our support contact details including email, phone, and WhatsApp. For urgent technical issues, describe the problem clearly and include any error messages or screenshots.",
    category: "Technical Support", sortOrder: 1, status: "published",
  },
  {
    question: "What should I do if copy trading is not working?",
    answer: "Check these steps: 1. Ensure your subscription is active and not expired. 2. Verify your slave account status shows Connected. 3. Check that your binding is Active (not Suspended). 4. Confirm the master account is Active. If all these are correct and trades are still not copying, contact support.",
    category: "Technical Support", sortOrder: 2, status: "published",
  },
];

let seedDone = false;
async function seedFaqsIfEmpty(): Promise<void> {
  if (seedDone) return;
  seedDone = true;
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqsTable);
    if (count > 0) return;
    await db.insert(faqsTable).values(INITIAL_FAQS);
  } catch {
    seedDone = false;
  }
}

// ── Public list ───────────────────────────────────────────────────────────────

router.get("/faqs", async (req, res): Promise<void> => {
  void seedFaqsIfEmpty();

  const { category, q } = req.query as Record<string, string | undefined>;

  const isAdmin = false;

  const conditions = [];
  if (!isAdmin) {
    conditions.push(eq(faqsTable.status, "published"));
  }
  if (category && category !== "All") {
    conditions.push(eq(faqsTable.category, category));
  }
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(
      or(ilike(faqsTable.question, term), ilike(faqsTable.answer, term))!
    );
  }

  const rows = await db
    .select()
    .from(faqsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(faqsTable.sortOrder), asc(faqsTable.id));

  res.json(rows);
});

// ── Admin list (all statuses) ─────────────────────────────────────────────────

router.get("/admin/faqs", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(faqsTable)
    .orderBy(asc(faqsTable.sortOrder), asc(faqsTable.id));
  res.json(rows);
});

// ── Reorder (must be before /:id) ────────────────────────────────────────────

router.patch("/faqs/reorder", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const items = req.body as Array<{ id: number; sortOrder: number }>;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Expected array of {id, sortOrder}" });
    return;
  }
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      db
        .update(faqsTable)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(faqsTable.id, id))
    )
  );
  res.json({ ok: true });
});

// ── Single FAQ (public, increments viewCount) ─────────────────────────────────

router.get("/faqs/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(faqsTable).where(eq(faqsTable.id, id));
  if (!row || row.status !== "published") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db
    .update(faqsTable)
    .set({ viewCount: row.viewCount + 1 })
    .where(eq(faqsTable.id, id));

  res.json({ ...row, viewCount: row.viewCount + 1 });
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post("/faqs", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { question, answer, category, sortOrder, status } = req.body as Record<string, unknown>;
  if (!question || !answer || !category) {
    res.status(400).json({ error: "question, answer, and category are required" });
    return;
  }
  const [row] = await db
    .insert(faqsTable)
    .values({
      question: String(question),
      answer: String(answer),
      category: String(category),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      status: status === "published" ? "published" : "draft",
    })
    .returning();
  res.status(201).json(row);
});

// ── Update ────────────────────────────────────────────────────────────────────

router.patch("/faqs/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const { question, answer, category, sortOrder, status } = req.body as Record<string, unknown>;
  const updates: Partial<typeof faqsTable.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (question != null) updates.question = String(question);
  if (answer != null) updates.answer = String(answer);
  if (category != null) updates.category = String(category);
  if (sortOrder != null) updates.sortOrder = Number(sortOrder);
  if (status != null) updates.status = String(status);

  const [row] = await db
    .update(faqsTable)
    .set(updates)
    .where(eq(faqsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/faqs/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(faqsTable).where(eq(faqsTable.id, id));
  res.sendStatus(204);
});

// ── Search log ────────────────────────────────────────────────────────────────

router.post("/faqs/search-log", authenticate, async (req, res): Promise<void> => {
  const { searchTerm, resultCount } = req.body as Record<string, unknown>;
  if (!searchTerm || typeof searchTerm !== "string" || !searchTerm.trim()) {
    res.status(400).json({ error: "searchTerm required" });
    return;
  }
  await db.insert(faqSearchLogsTable).values({
    searchTerm: searchTerm.trim().toLowerCase(),
    resultCount: typeof resultCount === "number" ? resultCount : 0,
    userId: req.userId ?? null,
  });
  res.json({ ok: true });
});

// ── FAQ Analytics (admin) ─────────────────────────────────────────────────────

router.get("/admin/faq-analytics", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [topViewed, topSearches] = await Promise.all([
    db
      .select()
      .from(faqsTable)
      .orderBy(desc(faqsTable.viewCount))
      .limit(10),
    db
      .select({
        searchTerm: faqSearchLogsTable.searchTerm,
        count: sql<number>`count(*)::int`,
      })
      .from(faqSearchLogsTable)
      .groupBy(faqSearchLogsTable.searchTerm)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);
  res.json({ topViewed, topSearches });
});

export default router;
