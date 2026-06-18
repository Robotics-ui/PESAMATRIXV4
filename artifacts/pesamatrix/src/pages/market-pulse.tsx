import { useEffect, useState } from "react";
import { useGetMarketPulse, getGetMarketPulseQueryKey } from "@workspace/api-client-react";
import type { MarketPulseRate, MarketSentiment } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

function fmt(value: number, pair: string): string {
  return value.toFixed(pair.includes("JPY") ? 3 : 5);
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs tabular-nums">
      {time.toUTCString().replace("GMT", "UTC")}
    </span>
  );
}

function StatusBadge({ status }: { status: "OPEN" | "CLOSED" | "OPENING_SOON" }) {
  const cfg = {
    OPEN:         { color: "#16a34a", shadow: "#16a34a55", label: "MARKET OPEN" },
    CLOSED:       { color: "#dc2626", shadow: "#dc262655", label: "MARKET CLOSED" },
    OPENING_SOON: { color: "#d97706", shadow: "#d9770655", label: "OPENS SOON" },
  }[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full animate-pulse"
        style={{ backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.shadow}` }}
      />
      <span className="text-sm font-semibold tracking-widest" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

function SentimentMeter({ sentiment }: { sentiment: MarketSentiment }) {
  const { bullish, bearish, neutral, sentimentScore, score } = sentiment;
  const total = bullish + bearish + neutral || 1;
  const bullPct = Math.round((bullish / total) * 100);
  const bearPct = Math.round((bearish / total) * 100);
  const neutralPct = 100 - bullPct - bearPct;

  const label =
    sentimentScore > 20 ? "BULLISH" :
    sentimentScore < -20 ? "BEARISH" : "NEUTRAL";
  const labelColor =
    sentimentScore > 20 ? "#16a34a" :
    sentimentScore < -20 ? "#dc2626" : "#94a3b8";

  const needlePos = Math.max(0, Math.min(100, (sentimentScore + 100) / 2));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Market Sentiment</p>
          <p className="text-2xl font-bold tracking-widest" style={{ color: labelColor }}>
            {label}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Avg change: {score >= 0 ? "+" : ""}{score.toFixed(3)}%
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs"><span className="text-green-400 font-semibold">{bullish}</span> <span className="text-white/40">bullish</span></p>
          <p className="text-xs"><span className="text-red-400 font-semibold">{bearish}</span> <span className="text-white/40">bearish</span></p>
          <p className="text-xs"><span className="text-white/50 font-semibold">{neutral}</span> <span className="text-white/40">neutral</span></p>
        </div>
      </div>

      {/* Pair distribution bar */}
      <div className="space-y-1.5">
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
          <div className="bg-green-500/70 transition-all duration-700" style={{ width: `${bullPct}%` }} />
          <div className="bg-white/20 transition-all duration-700" style={{ width: `${neutralPct}%` }} />
          <div className="bg-red-500/70 transition-all duration-700" style={{ width: `${bearPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/30">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      {/* Needle gauge */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">Sentiment Score</p>
        <div className="relative h-5">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(to right, #dc2626, #d97706, #16a34a)",
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow-[0_0_6px_#fff] transition-all duration-700"
            style={{ left: `${needlePos}%`, transform: "translateX(-50%)" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/30">
          <span>-100</span>
          <span className="font-bold text-white/60">{sentimentScore > 0 ? "+" : ""}{sentimentScore}</span>
          <span>+100</span>
        </div>
      </div>
    </div>
  );
}

function DailyRangeBar({ rate }: { rate: MarketPulseRate }) {
  const pos = Math.max(2, Math.min(98, rate.rangePosition));
  const isJpy = rate.pair.includes("JPY");
  const prec = isJpy ? 3 : 5;

  const change = rate.changePercent;
  const barColor = change > 0 ? "#16a34a" : change < 0 ? "#dc2626" : "#64748b";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-white/30 font-mono">
        <span>L {rate.dailyLow.toFixed(prec)}</span>
        <span>O {rate.dailyOpen.toFixed(prec)}</span>
        <span>H {rate.dailyHigh.toFixed(prec)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/10">
        {/* Filled portion up to current price */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pos}%`, backgroundColor: barColor, opacity: 0.5 }}
        />
        {/* Position marker */}
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm shadow-lg transition-all duration-700"
          style={{ left: `${pos}%`, transform: "translateX(-50%) translateY(-50%)", backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-white/20">
        <span>Low</span>
        <span className="text-white/40">{pos}% from low</span>
        <span>High</span>
      </div>
    </div>
  );
}

function PairCard({ rate }: { rate: MarketPulseRate }) {
  const isUp = rate.direction === "up";
  const isDown = rate.direction === "down";
  const color = isUp ? "#16a34a" : isDown ? "#dc2626" : "#64748b";
  const pctSign = rate.changePercent >= 0 ? "+" : "";
  const isJpy = rate.pair.includes("JPY");

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold tracking-wider text-white/90">{rate.pair}</p>
          <p className="text-xl font-mono font-bold text-white mt-0.5">
            {fmt(rate.midPrice, rate.pair)}
          </p>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <span>{isUp ? "▲" : isDown ? "▼" : "–"}</span>
          <span>{pctSign}{rate.changePercent.toFixed(3)}%</span>
        </div>
      </div>

      {/* Daily range bar */}
      <DailyRangeBar rate={rate} />

      {/* Bid / Ask / Spread */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.06]">
        {[
          { label: "Bid", value: fmt(rate.bid, rate.pair) },
          { label: "Ask", value: fmt(rate.ask, rate.pair) },
          { label: "Spread", value: String(rate.spread) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-xs font-mono text-white/70">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MarketPulsePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading, isError, dataUpdatedAt } = useGetMarketPulse({
    query: {
      queryKey: getGetMarketPulseQueryKey(),
      refetchInterval: 15_000,
      retry: 2,
    },
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const marketStatus = (data?.marketStatus ?? "OPEN") as "OPEN" | "CLOSED" | "OPENING_SOON";
  const rates = (data?.rates ?? []) as MarketPulseRate[];
  const sentiment = data?.sentiment as MarketSentiment | undefined;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, #0f2040 0%, #070d18 60%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070d18]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-white">
                <path d="M3 17l4-8 4 4 4-6 4 6" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-wider text-sm">PESAMATRIX</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 tracking-widest">
              MARKET PULSE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-white/30">
              <LiveClock />
            </div>
            <button
              onClick={() => navigate(user ? "/dashboard" : "/login")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              {user ? "Dashboard" : "Sign In"}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Forex Market Pulse
              </h1>
              <p className="text-sm text-white/40 mt-1">
                Live rates, daily ranges, and market sentiment — updated every 15 seconds
              </p>
            </div>
            {data && <StatusBadge status={marketStatus} />}
          </div>
          {lastUpdated && (
            <p className="text-[11px] text-white/25 font-mono">
              Last updated: {lastUpdated.toLocaleTimeString()} UTC
              {data?.isStale && <span className="ml-2 text-amber-400"> (stale data)</span>}
            </p>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-24">
            <div className="space-y-3 text-center">
              <div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-white/40">Fetching live market data...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-400 text-sm font-semibold">Market data temporarily unavailable</p>
            <p className="text-white/30 text-xs mt-1">Please check back shortly</p>
          </div>
        )}

        {/* Content */}
        {data && !isLoading && (
          <>
            {/* Sentiment + summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                {sentiment && <SentimentMeter sentiment={sentiment} />}
              </div>

              {/* Session summary cards */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Pairs Tracked", value: String(rates.length), sub: "All major pairs" },
                  {
                    label: "Bullish Pairs",
                    value: String(sentiment?.bullish ?? 0),
                    sub: `${Math.round(((sentiment?.bullish ?? 0) / (rates.length || 1)) * 100)}% of tracked`,
                    color: "#16a34a",
                  },
                  {
                    label: "Bearish Pairs",
                    value: String(sentiment?.bearish ?? 0),
                    sub: `${Math.round(((sentiment?.bearish ?? 0) / (rates.length || 1)) * 100)}% of tracked`,
                    color: "#dc2626",
                  },
                  {
                    label: "Best Performer",
                    value: rates.length
                      ? rates.slice().sort((a, b) => b.changePercent - a.changePercent)[0]?.pair ?? "—"
                      : "—",
                    sub: rates.length
                      ? `+${(rates.slice().sort((a, b) => b.changePercent - a.changePercent)[0]?.changePercent ?? 0).toFixed(3)}%`
                      : "",
                    color: "#16a34a",
                  },
                  {
                    label: "Worst Performer",
                    value: rates.length
                      ? rates.slice().sort((a, b) => a.changePercent - b.changePercent)[0]?.pair ?? "—"
                      : "—",
                    sub: rates.length
                      ? `${(rates.slice().sort((a, b) => a.changePercent - b.changePercent)[0]?.changePercent ?? 0).toFixed(3)}%`
                      : "",
                    color: "#dc2626",
                  },
                  {
                    label: "Market Status",
                    value: marketStatus === "OPEN" ? "Open" : marketStatus === "OPENING_SOON" ? "Soon" : "Closed",
                    sub: marketStatus === "OPEN" ? "Trading active" : marketStatus === "OPENING_SOON" ? "Opens in minutes" : "Next open: Mon 22:00 UTC",
                    color: marketStatus === "OPEN" ? "#16a34a" : marketStatus === "OPENING_SOON" ? "#d97706" : "#dc2626",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-xl font-bold" style={{ color: color ?? "#f1f5f9" }}>{value}</p>
                    {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Pair grid */}
            <div>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
                Live Pair Data
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {rates.map((rate) => (
                  <PairCard key={rate.pair} rate={rate} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/[0.06] py-6 text-center text-[11px] text-white/20 space-y-1">
        <p>Market data provided by <span className="text-white/40">Frankfurter.app</span> — free, open-source FX reference rates</p>
        <p>Rates refresh every 15 seconds &nbsp;|&nbsp; Daily ranges are estimated &nbsp;|&nbsp; Not financial advice</p>
        <p className="mt-2">
          <button
            onClick={() => navigate("/login")}
            className="text-blue-400/60 hover:text-blue-400 transition-colors underline underline-offset-2"
          >
            Sign in to PESAMATRIX
          </button>
          {" "}to access copy trading
        </p>
      </footer>
    </div>
  );
}
