import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const token = () => localStorage.getItem("token") ?? "";

type BindingInfo = {
  id: number;
  strategyId: number;
  strategyName: string | null;
  copyfactoryStrategyId: string | null;
  status: string;
  riskMultiplier: number;
  createdAt: string;
  lastSyncedAt: string | null;
};

type SubscriberRow = {
  slaveAccountId: number;
  mt5Login: string;
  broker: string;
  server: string;
  platform: string;
  slaveStatus: string;
  connectionStatus: string | null;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  copyFactorySubscriberId: string | null;
  copyFactorySubscriberStatus: string | null;
  copyFactorySubscriberRegisteredAt: string | null;
  copyFactoryLastSyncedAt: string | null;
  copyFactoryLastError: string | null;
  subscriptionStatus: string | null;
  subscriptionEndDate: string | null;
  bindings: BindingInfo[];
};

type VerifyReport = {
  generatedAt: string;
  checks: {
    providerExists: { ok: boolean; count: number; accountIds: (string | null)[] };
    strategiesRegistered: { ok: boolean; total: number; withCfId: number; cfIds: (string | null)[] };
    subscribersRegistered: { ok: boolean; total: number; registered: number; unregistered: number };
    bindingsActive: { ok: boolean; total: number; active: number; suspended: number };
  };
  subscribers: {
    slaveAccountId: number;
    mt5Login: string;
    broker: string;
    userName: string | null;
    subscriberId: string | null;
    subscriberStatus: string | null;
    lastSyncedAt: string | null;
    subscriptionStatus: string | null;
    activeBindings: number;
    suspendedBindings: number;
  }[];
  issues: string[];
  allGreen: boolean;
};

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground text-xs">None</Badge>;
  const color =
    status === "connected" || status === "active" || status === "registered"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : status === "free_trial"
      ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
      : status === "suspended" || status === "failed"
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return <Badge variant="outline" className={cn("text-xs", color)}>{status}</Badge>;
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok
        ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
        : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />}
      <span className={ok ? "text-foreground" : "text-red-400"}>{label}</span>
      <span className="text-muted-foreground text-xs ml-auto">{detail}</span>
    </div>
  );
}

export function CfSubscribersTab() {
  const [subscribers, setSubscribers] = useState<SubscriberRow[] | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, verifyRes] = await Promise.all([
        fetch("/api/admin/copyfactory-subscribers", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/admin/copyfactory-verify", { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (!subsRes.ok || !verifyRes.ok) throw new Error("Failed to fetch CopyFactory data");
      const [subs, verify] = await Promise.all([subsRes.json(), verifyRes.json()]);
      setSubscribers(subs as SubscriberRow[]);
      setReport(verify as VerifyReport);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleRow = (id: number) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Verification report card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {report?.allGreen
                  ? <CheckCircle className="h-4 w-4 text-green-400" />
                  : <AlertCircle className="h-4 w-4 text-red-400" />}
                CopyFactory Integration Status
              </CardTitle>
              {report && (
                <CardDescription className="mt-0.5">
                  Last checked: {timeAgo(report.generatedAt)}
                </CardDescription>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        {report && (
          <CardContent className="space-y-2">
            <CheckRow
              ok={report.checks.providerExists.ok}
              label="Provider registered"
              detail={`${report.checks.providerExists.count} master(s)`}
            />
            <CheckRow
              ok={report.checks.strategiesRegistered.ok}
              label="Strategies in CopyFactory"
              detail={`${report.checks.strategiesRegistered.withCfId} / ${report.checks.strategiesRegistered.total} active`}
            />
            <CheckRow
              ok={report.checks.subscribersRegistered.ok}
              label="Subscribers registered"
              detail={`${report.checks.subscribersRegistered.registered} / ${report.checks.subscribersRegistered.total} slaves`}
            />
            <CheckRow
              ok={report.checks.bindingsActive.ok}
              label="Active bindings healthy"
              detail={`${report.checks.bindingsActive.active} active, ${report.checks.bindingsActive.suspended} suspended`}
            />
            {report.issues.length > 0 && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-1">
                {report.issues.map((issue, i) => (
                  <p key={i} className="text-xs text-red-400">{issue}</p>
                ))}
              </div>
            )}
            {report.allGreen && (
              <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-xs text-green-400">All systems operational — CopyFactory pipeline is fully functional.</p>
              </div>
            )}
          </CardContent>
        )}
        {error && (
          <CardContent>
            <p className="text-sm text-red-400">{error}</p>
          </CardContent>
        )}
      </Card>

      {/* Subscriber rows */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subscriber Accounts</CardTitle>
          <CardDescription>All slave accounts and their CopyFactory subscriber + binding status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!subscribers && loading && (
            <p className="text-sm text-muted-foreground p-4">Loading...</p>
          )}
          {subscribers && subscribers.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No slave accounts found.</p>
          )}
          {subscribers && subscribers.length > 0 && (
            <div className="divide-y divide-border">
              {subscribers.map((row) => {
                const expanded = expandedRows.has(row.slaveAccountId);
                return (
                  <div key={row.slaveAccountId} className="px-4 py-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer select-none"
                      onClick={() => toggleRow(row.slaveAccountId)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{row.mt5Login}</span>
                          <span className="text-xs text-muted-foreground">{row.broker}</span>
                          <StatusBadge status={row.slaveStatus} />
                          <StatusBadge status={row.subscriptionStatus} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{row.userName ?? "Unknown"} &middot; {row.userEmail}</span>
                          {row.copyFactorySubscriberId
                            ? <span className="text-green-400">CF: {row.copyFactorySubscriberId.slice(0, 8)}...</span>
                            : <span className="text-red-400">CF: not registered</span>}
                          {row.copyFactoryLastSyncedAt && (
                            <span>Synced: {timeAgo(row.copyFactoryLastSyncedAt)}</span>
                          )}
                          <span>{row.bindings.filter(b => b.status === "active").length} active binding(s)</span>
                        </div>
                        {row.copyFactoryLastError && (
                          <p className="mt-0.5 text-xs text-red-400 truncate">{row.copyFactoryLastError}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 ml-2 space-y-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          <div className="text-muted-foreground">Slave ID</div><div className="text-foreground">{row.slaveAccountId}</div>
                          <div className="text-muted-foreground">Platform</div><div className="text-foreground">{row.platform}</div>
                          <div className="text-muted-foreground">Server</div><div className="text-foreground">{row.server}</div>
                          <div className="text-muted-foreground">Connection</div>
                          <div><StatusBadge status={row.connectionStatus} /></div>
                          <div className="text-muted-foreground">CF Subscriber ID</div>
                          <div className="text-foreground font-mono text-xs break-all">{row.copyFactorySubscriberId ?? "—"}</div>
                          <div className="text-muted-foreground">CF Subscriber Status</div>
                          <div><StatusBadge status={row.copyFactorySubscriberStatus} /></div>
                          <div className="text-muted-foreground">Registered At</div>
                          <div className="text-foreground">{row.copyFactorySubscriberRegisteredAt ? new Date(row.copyFactorySubscriberRegisteredAt).toLocaleString() : "—"}</div>
                          <div className="text-muted-foreground">Last Synced</div>
                          <div className="text-foreground">{row.copyFactoryLastSyncedAt ? new Date(row.copyFactoryLastSyncedAt).toLocaleString() : "—"}</div>
                          <div className="text-muted-foreground">Sub End Date</div>
                          <div className="text-foreground">{row.subscriptionEndDate ? new Date(row.subscriptionEndDate).toLocaleDateString() : "—"}</div>
                        </div>

                        {row.bindings.length > 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Bindings</p>
                            <div className="space-y-1.5">
                              {row.bindings.map((b) => (
                                <div key={b.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{b.strategyName ?? `Strategy #${b.strategyId}`}</span>
                                      <StatusBadge status={b.status} />
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3">
                                      <span>Multiplier: {b.riskMultiplier}x</span>
                                      {b.copyfactoryStrategyId
                                        ? <span className="text-green-400">CF ID: {b.copyfactoryStrategyId.slice(0, 8)}...</span>
                                        : <span className="text-red-400">CF ID missing</span>}
                                      {b.lastSyncedAt && <span>Synced: {timeAgo(b.lastSyncedAt)}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No bindings yet</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
