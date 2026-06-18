import { Router } from "express";
import { db, bannerSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { logger } from "../lib/logger";

const router = Router();

interface CachedRates {
  baseRates: Record<string, number>;
  previousRates: Record<string, number> | null;
  fetchedAt: number;
}

let ratesCache: CachedRates | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

const PAIR_CONFIG: Record<string, { spreadPips: number; pipSize: number; precision: number }> = {
  "EUR/USD": { spreadPips: 1.2, pipSize: 0.0001, precision: 5 },
  "GBP/USD": { spreadPips: 1.5, pipSize: 0.0001, precision: 5 },
  "USD/JPY": { spreadPips: 1.5, pipSize: 0.01,   precision: 3 },
  "USD/CHF": { spreadPips: 1.8, pipSize: 0.0001, precision: 5 },
  "AUD/USD": { spreadPips: 1.5, pipSize: 0.0001, precision: 5 },
  "NZD/USD": { spreadPips: 2.5, pipSize: 0.0001, precision: 5 },
  "USD/CAD": { spreadPips: 2.0, pipSize: 0.0001, precision: 5 },
  "EUR/GBP": { spreadPips: 1.8, pipSize: 0.0001, precision: 5 },
  "EUR/JPY": { spreadPips: 2.5, pipSize: 0.01,   precision: 3 },
  "GBP/JPY": { spreadPips: 3.0, pipSize: 0.01,   precision: 3 },
};

function computePairMid(pair: string, rates: Record<string, number>): number {
  const [base, quote] = pair.split("/") as [string, string];
  if (base === "USD") return rates[quote] ?? 1;
  if (quote === "USD") return 1 / (rates[base] ?? 1);
  return (rates[quote] ?? 1) / (rates[base] ?? 1);
}

function getMarketStatus(): "OPEN" | "CLOSED" | "OPENING_SOON" {
  const now = new Date();
  const day = now.getUTCDay();
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (day === 6) return "CLOSED";
  if (day === 0) {
    if (totalMinutes >= 22 * 60) return "OPEN";
    if (totalMinutes >= 21 * 60 + 30) return "OPENING_SOON";
    return "CLOSED";
  }
  if (day === 5 && totalMinutes >= 22 * 60) return "CLOSED";
  return "OPEN";
}

async function fetchBaseRates(): Promise<Record<string, number>> {
  const res = await fetch(
    "https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP,JPY,CHF,AUD,NZD,CAD",
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number> };
  return data.rates;
}

function buildRates(
  baseRates: Record<string, number>,
  prevRates: Record<string, number> | null,
  selectedPairs: string[]
) {
  return selectedPairs
    .filter((p) => p in PAIR_CONFIG)
    .map((pair) => {
      const config = PAIR_CONFIG[pair]!;
      const baseMid = computePairMid(pair, baseRates);
      const fluctuation = (Math.random() - 0.5) * config.pipSize * 3;
      const mid = baseMid + fluctuation;

      const spreadValue = config.spreadPips * config.pipSize;
      const bid = mid - spreadValue / 2;
      const ask = mid + spreadValue / 2;

      let changePercent: number;
      let change: number;

      if (prevRates) {
        const prevMid = computePairMid(pair, prevRates);
        change = mid - prevMid;
        changePercent = (change / prevMid) * 100;
      } else {
        changePercent = (Math.random() - 0.48) * 0.5;
        change = baseMid * (changePercent / 100);
      }

      const direction =
        changePercent > 0.001 ? "up" : changePercent < -0.001 ? "down" : "neutral";

      return {
        pair,
        bid: parseFloat(bid.toFixed(config.precision)),
        ask: parseFloat(ask.toFixed(config.precision)),
        spread: parseFloat(spreadValue.toFixed(config.precision + 1)),
        midPrice: parseFloat(mid.toFixed(config.precision)),
        change: parseFloat(change.toFixed(config.precision)),
        changePercent: parseFloat(changePercent.toFixed(4)),
        direction,
      };
    });
}

router.get("/forex/rates", async (_req, res): Promise<void> => {
  try {
    const now = Date.now();

    if (!ratesCache || now - ratesCache.fetchedAt > CACHE_TTL_MS) {
      const previousRates = ratesCache?.baseRates ?? null;
      const baseRates = await fetchBaseRates();
      ratesCache = { baseRates, previousRates, fetchedAt: now };
    }

    let settings;
    try {
      [settings] = await db.select().from(bannerSettingsTable).limit(1);
    } catch { /* ignore DB error, use all pairs */ }

    const selectedPairs: string[] = settings?.selectedPairs
      ? (JSON.parse(settings.selectedPairs) as string[])
      : Object.keys(PAIR_CONFIG);

    res.json({
      rates: buildRates(ratesCache.baseRates, ratesCache.previousRates, selectedPairs),
      marketStatus: getMarketStatus(),
      cachedAt: new Date(ratesCache.fetchedAt).toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch forex rates");

    if (ratesCache) {
      const all = Object.keys(PAIR_CONFIG);
      res.json({
        rates: buildRates(ratesCache.baseRates, null, all),
        marketStatus: getMarketStatus(),
        cachedAt: new Date(ratesCache.fetchedAt).toISOString(),
        isStale: true,
      });
      return;
    }

    res.status(503).json({ error: "Market data temporarily unavailable" });
  }
});

router.get("/forex/banner-settings", async (_req, res): Promise<void> => {
  try {
    let [settings] = await db.select().from(bannerSettingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(bannerSettingsTable).values({}).returning();
    }
    res.json({ ...settings, selectedPairs: JSON.parse(settings.selectedPairs) as string[] });
  } catch (err) {
    logger.error({ err }, "Failed to get banner settings");
    res.status(500).json({ error: "Failed to get banner settings" });
  }
});

router.patch("/forex/banner-settings", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.displayMode === "string") patch.displayMode = body.displayMode;
    if (typeof body.backgroundColor === "string") patch.backgroundColor = body.backgroundColor;
    if (typeof body.primaryColor === "string") patch.primaryColor = body.primaryColor;
    if (typeof body.secondaryColor === "string") patch.secondaryColor = body.secondaryColor;
    if (typeof body.textColor === "string") patch.textColor = body.textColor;
    if (typeof body.bullishColor === "string") patch.bullishColor = body.bullishColor;
    if (typeof body.bearishColor === "string") patch.bearishColor = body.bearishColor;
    if (typeof body.fontFamily === "string") patch.fontFamily = body.fontFamily;
    if (typeof body.fontSize === "number") patch.fontSize = body.fontSize;
    if (typeof body.bannerHeight === "number") patch.bannerHeight = body.bannerHeight;
    if (typeof body.tickerSpeed === "number") patch.tickerSpeed = body.tickerSpeed;
    if (typeof body.refreshRate === "number") patch.refreshRate = body.refreshRate;
    if (Array.isArray(body.selectedPairs)) patch.selectedPairs = JSON.stringify(body.selectedPairs);

    let [settings] = await db.select().from(bannerSettingsTable).limit(1);

    if (!settings) {
      [settings] = await db.insert(bannerSettingsTable).values(patch).returning();
    } else {
      [settings] = await db
        .update(bannerSettingsTable)
        .set(patch)
        .where(eq(bannerSettingsTable.id, settings.id))
        .returning();
    }

    res.json({ ...settings, selectedPairs: JSON.parse(settings.selectedPairs) as string[] });
  } catch (err) {
    logger.error({ err }, "Failed to update banner settings");
    res.status(500).json({ error: "Failed to update banner settings" });
  }
});


// ADR in pip-units (used to simulate daily high/low)
const ADR: Record<string, number> = {
  "EUR/USD": 0.0080, "GBP/USD": 0.0100, "USD/JPY": 0.80,
  "USD/CHF": 0.0080, "AUD/USD": 0.0080, "NZD/USD": 0.0080,
  "USD/CAD": 0.0080, "EUR/GBP": 0.0060, "EUR/JPY": 1.00, "GBP/JPY": 1.50,
};

// Deterministic pseudo-random per pair+day so ranges don't jump on every request
function dateHash(pair: string): number {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const str = today + pair;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

function buildMarketPulseRates(
  baseRates: Record<string, number>,
  prevRates: Record<string, number> | null
) {
  const pairs = Object.keys(PAIR_CONFIG);
  return pairs.map((pair) => {
    const config = PAIR_CONFIG[pair]!;
    const baseMid = computePairMid(pair, baseRates);
    const mid = baseMid;

    const spreadValue = config.spreadPips * config.pipSize;
    const bid = mid - spreadValue / 2;
    const ask = mid + spreadValue / 2;

    let changePercent: number;
    let change: number;
    if (prevRates) {
      const prevMid = computePairMid(pair, prevRates);
      change = mid - prevMid;
      changePercent = (change / prevMid) * 100;
    } else {
      changePercent = (dateHash(pair + "pct") - 0.48) * 0.5;
      change = baseMid * (changePercent / 100);
    }

    const direction =
      changePercent > 0.001 ? "up" : changePercent < -0.001 ? "down" : "neutral";

    const dailyOpen = mid - change;
    const adr = ADR[pair] ?? 0.008;
    const h = dateHash(pair);
    const h2 = dateHash(pair + "2");
    const sessionHigh = Math.max(dailyOpen, mid) + adr * h * 0.6;
    const sessionLow  = Math.min(dailyOpen, mid) - adr * h2 * 0.6;
    const rangePosition = sessionHigh > sessionLow
      ? Math.round(((mid - sessionLow) / (sessionHigh - sessionLow)) * 100)
      : 50;

    return {
      pair,
      bid:          parseFloat(bid.toFixed(config.precision)),
      ask:          parseFloat(ask.toFixed(config.precision)),
      spread:       parseFloat(spreadValue.toFixed(config.precision + 1)),
      midPrice:     parseFloat(mid.toFixed(config.precision)),
      change:       parseFloat(change.toFixed(config.precision)),
      changePercent: parseFloat(changePercent.toFixed(4)),
      direction,
      dailyOpen:    parseFloat(dailyOpen.toFixed(config.precision)),
      dailyHigh:    parseFloat(sessionHigh.toFixed(config.precision)),
      dailyLow:     parseFloat(sessionLow.toFixed(config.precision)),
      rangePosition,
    };
  });
}

router.get("/forex/market-pulse", async (_req, res): Promise<void> => {
  try {
    const now = Date.now();
    if (!ratesCache || now - ratesCache.fetchedAt > CACHE_TTL_MS) {
      const previousRates = ratesCache?.baseRates ?? null;
      const baseRates = await fetchBaseRates();
      ratesCache = { baseRates, previousRates, fetchedAt: now };
    }

    const rates = buildMarketPulseRates(ratesCache.baseRates, ratesCache.previousRates);
    const bullish = rates.filter((r) => r.direction === "up").length;
    const bearish = rates.filter((r) => r.direction === "down").length;
    const neutral = rates.filter((r) => r.direction === "neutral").length;
    const total = rates.length;
    const avgChangePercent = rates.reduce((s, r) => s + r.changePercent, 0) / total;
    const score = Math.round(((bullish - bearish) / total) * 100);

    res.json({
      rates,
      marketStatus: getMarketStatus(),
      cachedAt: new Date(ratesCache.fetchedAt).toISOString(),
      sentiment: { bullish, bearish, neutral, score: parseFloat(avgChangePercent.toFixed(4)), sentimentScore: score },
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch market pulse");
    if (ratesCache) {
      const rates = buildMarketPulseRates(ratesCache.baseRates, null);
      res.json({
        rates,
        marketStatus: getMarketStatus(),
        cachedAt: new Date(ratesCache.fetchedAt).toISOString(),
        isStale: true,
        sentiment: { bullish: 0, bearish: 0, neutral: rates.length, score: 0, sentimentScore: 0 },
      });
      return;
    }
    res.status(503).json({ error: "Market data temporarily unavailable" });
  }
});

export default router;
