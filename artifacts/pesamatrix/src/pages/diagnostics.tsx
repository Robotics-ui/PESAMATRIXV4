import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Server, Users, WifiOff, Activity, Loader2,
  ChevronDown, ChevronRight, Globe, Hash, AlertTriangle, CheckCircle2, XCircle, Clock,
  ShieldCheck, ShieldAlert, ShieldOff,
} from "lucide-react";

type AccountRecord = {
  id: number;
  userId: number;
  metaapiAccountId: string | null;
  mt5Login: string;
  broker: string;
  server: string;
  status: string;
  deploymentStatus: string | null;
  connectionStatus: string | null;
  synchronizationStatus: string | null;
  lastErrorMessage: string | null;
  metaapiRegion: string | null;
  lastCheckedAt: string | null;
  userEmail: string | null;
  rejectionReason?: string | null;
  copyFactoryProviderId?: string | null;
  copyFactoryProviderStatus?: string | null;
  copyFactoryProviderRegisteredAt?: string | null;
  copyFactoryLastApiResponse?: string | null;
  copyFactoryLastError?: string | null;
};

type DiagnosticsData = {
  summary: {
    masters: Record<string, number>;
    slaves: Record<string, number>;
  };
  masters: AccountRecord[];
  slaves: AccountRecord[];
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "bg-green-500/20 text-green-400 border-green-500/30",
    synchronizing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    connecting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    deploying: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    disconnected: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    pending: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    pending_approval: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    suspended: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return <Badge className={`text-xs font-mono uppercase ${map[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>{status}</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "connected") return <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />;
  if (status === "failed" || status === "rejected") return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (status === "disconnected") return <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
  if (status === "pending" || status === "pending_approval") return <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  return <RefreshCw className="h-3.5 w-3.5 text-blue-400 shrink-0 animate-spin" />;
}

function formatCheckedAt(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return new Date(ts).toLocaleTimeString();
}

function ProviderStatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "registered") return (
    <span className="flex items-center gap-1 text-green-400 font-mono text-xs">
      <ShieldCheck className="h-3.5 w-3.5" /> registered
    </span>
  );
  if (status === "failed") return (
    <span className="flex items-center gap-1 text-red-400 font-mono text-xs">
      <ShieldAlert className="h-3.5 w-3.5" /> failed
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
      <ShieldOff className="h-3.5 w-3.5" /> not registered
    </span>
  );
}

function AccountRow({ a, type, token, onRefresh }: { a: AccountRecord; type: "master" | "slave"; token: string | null; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleRegisterProvider(e: React.MouseEvent) {
    e.stopPropagation();
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const res = await fetch(`/api/admin/master-accounts/${a.id}/register-provider`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (res.ok) {
        setRegisterMsg({ ok: true, text: json.message ?? "Registered" });
        setTimeout(() => { setRegisterMsg(null); onRefresh(); }, 2000);
      } else {
        setRegisterMsg({ ok: false, text: json.error ?? "Registration failed" });
      }
    } catch {
      setRegisterMsg({ ok: false, text: "Network error" });
    } finally {
      setRegistering(false);
    }
  }

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-2.5 pr-3 w-6">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </td>
        <td className="py-2.5 pr-3">
          <div className="flex items-center gap-1.5">
            <StatusIcon status={a.status} />
            <span className="text-xs font-mono text-muted-foreground">#{a.id}</span>
          </div>
        </td>
        <td className="py-2.5 pr-3">
          <p className="text-sm font-medium text-foreground">{a.mt5Login}</p>
          <p className="text-xs text-muted-foreground">{a.broker}</p>
        </td>
        <td className="py-2.5 pr-3 max-w-[160px]">
          {a.metaapiAccountId ? (
            <span className="text-xs font-mono text-blue-400 block truncate" title={a.metaapiAccountId}>
              {a.metaapiAccountId.slice(0, 8)}…{a.metaapiAccountId.slice(-6)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">not deployed</span>
          )}
        </td>
        <td className="py-2.5 pr-3"><StatusBadge status={a.status} /></td>
        <td className="py-2.5 pr-3">
          <span className="text-xs font-mono text-muted-foreground">{a.deploymentStatus ?? "—"}</span>
        </td>
        <td className="py-2.5 pr-3">
          {a.synchronizationStatus ? (
            <span className={`text-xs font-mono ${a.synchronizationStatus === "SYNCHRONIZED" ? "text-green-400" : "text-yellow-400"}`}>
              {a.synchronizationStatus}
            </span>
          ) : <span className="text-xs text-muted-foreground/50">—</span>}
        </td>
        <td className="py-2.5 pr-3">
          {a.metaapiRegion
            ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{a.metaapiRegion}</span>
            : <span className="text-xs text-muted-foreground/50">—</span>}
        </td>
        <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {formatCheckedAt(a.lastCheckedAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/30">
          <td colSpan={9} className="px-8 py-4 bg-muted/10">
            <div className="space-y-4">
              {/* MetaApi / lifecycle grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                {/* Left column */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0 flex items-center gap-1"><Hash className="h-3 w-3" />Local DB ID:</span>
                    <span className="font-mono text-foreground">#{a.id} ({type} account)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Real MetaApi UUID:</span>
                    <span className="font-mono text-blue-300 break-all">
                      {a.metaapiAccountId ?? "Not yet assigned — MetaApi deployment has not run"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">MetaApi Region:</span>
                    <span className="font-mono text-foreground">{a.metaapiRegion ?? "Unknown"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Broker Server:</span>
                    <span className="font-mono text-foreground">{a.server}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Owner (User ID):</span>
                    <span className="font-mono text-foreground">{a.userEmail ?? `uid:${a.userId}`}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Created:</span>
                    <span className="font-mono text-foreground">{new Date(a.lastCheckedAt ?? "").toLocaleString() || "—"}</span>
                  </div>
                </div>
                {/* Right column */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Internal Status:</span>
                    <span className="font-mono text-foreground">{a.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Deployment State:</span>
                    <span className="font-mono text-foreground">{a.deploymentStatus ?? "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Connection Status:</span>
                    <span className={`font-mono ${a.connectionStatus === "CONNECTED" ? "text-green-400" : "text-foreground"}`}>
                      {a.connectionStatus ?? "—"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Sync Status:</span>
                    <span className={`font-mono ${a.synchronizationStatus === "SYNCHRONIZED" ? "text-green-400" : "text-foreground"}`}>
                      {a.synchronizationStatus ?? "—"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-40 shrink-0">Last Checked:</span>
                    <span className="font-mono text-foreground">
                      {a.lastCheckedAt ? new Date(a.lastCheckedAt).toLocaleString() : "Never polled"}
                    </span>
                  </div>
                  {a.lastErrorMessage && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-40 shrink-0 text-red-400">Last Error:</span>
                      <span className="font-mono text-red-400 break-all">{a.lastErrorMessage}</span>
                    </div>
                  )}
                  {a.rejectionReason && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-40 shrink-0 text-orange-400">Rejection Reason:</span>
                      <span className="font-mono text-orange-400">{a.rejectionReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CopyFactory provider section — masters only */}
              {type === "master" && (
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" /> CopyFactory Provider Registration
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-40 shrink-0">Provider Status:</span>
                        <ProviderStatusBadge status={a.copyFactoryProviderStatus} />
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-40 shrink-0">CF Provider ID:</span>
                        <span className="font-mono text-blue-300 break-all">
                          {a.copyFactoryProviderId ?? "—"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-40 shrink-0">Registered At:</span>
                        <span className="font-mono text-foreground">
                          {a.copyFactoryProviderRegisteredAt
                            ? new Date(a.copyFactoryProviderRegisteredAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {a.copyFactoryLastError && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-40 shrink-0 text-red-400">CF Last Error:</span>
                          <span className="font-mono text-red-400 break-all text-xs">{a.copyFactoryLastError}</span>
                        </div>
                      )}
                      {a.copyFactoryLastApiResponse && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-40 shrink-0">Last CF Response:</span>
                          <span className="font-mono text-muted-foreground break-all text-xs line-clamp-3">{a.copyFactoryLastApiResponse}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Register Provider button */}
                  {a.metaapiAccountId && a.copyFactoryProviderStatus !== "registered" && (
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        onClick={(e) => void handleRegisterProvider(e)}
                        disabled={registering}
                      >
                        {registering
                          ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Registering…</>
                          : <><ShieldCheck className="h-3 w-3 mr-1.5" />Register as CopyFactory Provider</>}
                      </Button>
                      {registerMsg && (
                        <span className={`text-xs font-mono ${registerMsg.ok ? "text-green-400" : "text-red-400"}`}>
                          {registerMsg.text}
                        </span>
                      )}
                    </div>
                  )}
                  {a.copyFactoryProviderStatus === "registered" && (
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-muted/30 text-muted-foreground hover:bg-muted/10"
                        onClick={(e) => void handleRegisterProvider(e)}
                        disabled={registering}
                      >
                        {registering
                          ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Re-registering…</>
                          : <><RefreshCw className="h-3 w-3 mr-1.5" />Re-register Provider</>}
                      </Button>
                      {registerMsg && (
                        <span className={`text-xs font-mono ${registerMsg.ok ? "text-green-400" : "text-red-400"}`}>
                          {registerMsg.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${color}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function DiagnosticsPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [pollerTriggering, setPollerTriggering] = useState(false);

  const { data, isLoading, error } = useQuery<DiagnosticsData>({
    queryKey: ["diagnostics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/diagnostics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch diagnostics");
      return res.json() as Promise<DiagnosticsData>;
    },
    refetchInterval: 15_000,
    enabled: !!token,
  });

  const triggerPoller = async () => {
    setPollerTriggering(true);
    try {
      await fetch("/api/admin/poller/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await new Promise((r) => setTimeout(r, 3_000));
      await qc.invalidateQueries({ queryKey: ["diagnostics"] });
    } finally {
      setPollerTriggering(false);
    }
  };

  const s = data?.summary;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Connection Diagnostics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real MetaApi UUIDs vs local DB IDs · deployment state · connection · sync · errors — auto-refreshes every 15s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void qc.invalidateQueries({ queryKey: ["diagnostics"] })} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => void triggerPoller()} disabled={pollerTriggering}>
              {pollerTriggering ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
              Poll Now
            </Button>
          </div>
        </div>

        {/* Legend */}
        <Card className="border-border/60 bg-muted/5">
          <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
            <p><span className="text-foreground font-medium">Local DB ID</span> — integer primary key assigned by this system (e.g. #1, #2). Never sent to MetaApi.</p>
            <p><span className="text-blue-400 font-medium">Real MetaApi UUID</span> — UUID returned by MetaApi provisioning API on successful account creation. This is proof the account exists in MetaApi.</p>
            <p><span className="text-foreground font-medium">Click any row</span> to expand full details.</p>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">
              Failed to load diagnostics. Make sure you are logged in as admin.
            </CardContent>
          </Card>
        )}

        {isLoading && !data && (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {s && (
          <>
            {/* Master summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-blue-400" />
                <h2 className="font-semibold text-foreground">Master Accounts ({s.masters.total})</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
                <StatCard label="Connected" value={s.masters.connected ?? 0} color="border-green-500/30 bg-green-500/5 text-green-400" />
                <StatCard label="Synchronizing" value={s.masters.synchronizing ?? 0} color="border-blue-500/30 bg-blue-500/5 text-blue-400" />
                <StatCard label="Connecting" value={s.masters.connecting ?? 0} color="border-yellow-500/30 bg-yellow-500/5 text-yellow-400" />
                <StatCard label="Deploying" value={s.masters.deploying ?? 0} color="border-purple-500/30 bg-purple-500/5 text-purple-400" />
                <StatCard label="Disconnected" value={s.masters.disconnected ?? 0} color="border-orange-500/30 bg-orange-500/5 text-orange-400" />
                <StatCard label="Failed" value={s.masters.failed ?? 0} color="border-red-500/30 bg-red-500/5 text-red-400" />
                <StatCard label="Pending" value={s.masters.pending ?? 0} color="border-gray-500/30 bg-gray-500/5 text-gray-400" />
                <StatCard label="Pending Approval" value={s.masters.pending_approval ?? 0} color="border-purple-500/30 bg-purple-500/5 text-purple-300" />
                <StatCard label="Rejected" value={s.masters.rejected ?? 0} color="border-red-500/30 bg-red-500/5 text-red-400" />
              </div>
            </div>

            {/* Slave summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-green-400" />
                <h2 className="font-semibold text-foreground">Slave Accounts ({s.slaves.total})</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <StatCard label="Connected" value={s.slaves.connected ?? 0} color="border-green-500/30 bg-green-500/5 text-green-400" />
                <StatCard label="Synchronizing" value={s.slaves.synchronizing ?? 0} color="border-blue-500/30 bg-blue-500/5 text-blue-400" />
                <StatCard label="Connecting" value={s.slaves.connecting ?? 0} color="border-yellow-500/30 bg-yellow-500/5 text-yellow-400" />
                <StatCard label="Deploying" value={s.slaves.deploying ?? 0} color="border-purple-500/30 bg-purple-500/5 text-purple-400" />
                <StatCard label="Disconnected" value={s.slaves.disconnected ?? 0} color="border-orange-500/30 bg-orange-500/5 text-orange-400" />
                <StatCard label="Failed" value={s.slaves.failed ?? 0} color="border-red-500/30 bg-red-500/5 text-red-400" />
                <StatCard label="Suspended" value={s.slaves.suspended ?? 0} color="border-orange-500/30 bg-orange-500/5 text-orange-400" />
                <StatCard label="Pending" value={s.slaves.pending ?? 0} color="border-gray-500/30 bg-gray-500/5 text-gray-400" />
              </div>
            </div>

            {/* Masters table */}
            {data.masters.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-4 w-4 text-blue-400" />
                    Master Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="w-6 py-2 pr-2" />
                          <th className="text-left py-2 pr-3">DB#</th>
                          <th className="text-left py-2 pr-3">Account</th>
                          <th className="text-left py-2 pr-3">MetaApi UUID</th>
                          <th className="text-left py-2 pr-3">Status</th>
                          <th className="text-left py-2 pr-3">Deploy</th>
                          <th className="text-left py-2 pr-3">Sync</th>
                          <th className="text-left py-2 pr-3">Region</th>
                          <th className="text-left py-2">Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.masters.map((a) => <AccountRow key={a.id} a={a} type="master" token={token} onRefresh={() => void qc.invalidateQueries({ queryKey: ["diagnostics"] })} />)}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slaves table */}
            {data.slaves.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-400" />
                    Slave Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="w-6 py-2 pr-2" />
                          <th className="text-left py-2 pr-3">DB#</th>
                          <th className="text-left py-2 pr-3">Account</th>
                          <th className="text-left py-2 pr-3">MetaApi UUID</th>
                          <th className="text-left py-2 pr-3">Status</th>
                          <th className="text-left py-2 pr-3">Deploy</th>
                          <th className="text-left py-2 pr-3">Sync</th>
                          <th className="text-left py-2 pr-3">Region</th>
                          <th className="text-left py-2">Checked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.slaves.map((a) => <AccountRow key={a.id} a={a} type="slave" token={token} onRefresh={() => void qc.invalidateQueries({ queryKey: ["diagnostics"] })} />)}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.masters.length === 0 && data.slaves.length === 0 && (
              <Card className="border-border">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <WifiOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-foreground">No accounts deployed yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Approve master accounts and add slave accounts to see status here</p>
                </CardContent>
              </Card>
            )}

            {/* Worker info */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" /> Background Workers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="font-medium text-foreground">Status Poller</p>
                    <p className="text-muted-foreground mt-0.5">Polls deploying/connecting/synchronizing accounts every 30s · 20 concurrent requests · supports 2,000 accounts</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Reconnect Worker</p>
                    <p className="text-muted-foreground mt-0.5">Every 5 min: retries disconnected accounts stale &gt;10 min + retries all failed accounts</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Subscription Enforcer</p>
                    <p className="text-muted-foreground mt-0.5">Every 30 min: expires subscriptions past their end date, suspends CopyFactory bindings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
