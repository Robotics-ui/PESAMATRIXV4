import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Activity, CheckCircle2, XCircle, Clock, AlertTriangle,
  RotateCcw, ChevronDown, ChevronUp, Zap, Server, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const token = () => localStorage.getItem("token") ?? "";

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

type WorkerStatus = "idle" | "running" | "failed" | "restarting";

interface WorkerRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jobsProcessed: number;
  errors: string[];
  success: boolean;
}

interface WorkerState {
  id: string;
  name: string;
  description: string;
  status: WorkerStatus;
  intervalMs: number;
  staleThresholdMs: number;
  registeredAt: string;
  lastTickAt: string | null;
  lastJobCompletedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: number;
  restartCount: number;
  maxRestarts: number;
  isStale: boolean;
  recentRuns: WorkerRun[];
}

interface WorkerSummary {
  total: number;
  running: number;
  idle: number;
  failed: number;
  restarting: number;
  stale: number;
}

interface WorkersResponse {
  workers: WorkerState[];
  summary: WorkerSummary;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatInterval(ms: number): string {
  if (ms < 60_000) return `${ms / 1000}s`;
  const mins = ms / 60_000;
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function StatusBadge({ status, isStale }: { status: WorkerStatus; isStale: boolean }) {
  if (isStale && status === "idle") {
    return (
      <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Stale
      </Badge>
    );
  }
  const map: Record<WorkerStatus, { label: string; className: string; Icon: React.ElementType }> = {
    idle: { label: "Idle", className: "bg-green-600/10 text-green-400 border-green-600/30", Icon: CheckCircle2 },
    running: { label: "Running", className: "bg-blue-600/10 text-blue-400 border-blue-600/30", Icon: CircleDot },
    failed: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/30", Icon: XCircle },
    restarting: { label: "Restarting", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", Icon: RotateCcw },
  };
  const { label, className, Icon } = map[status];
  return (
    <Badge className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", status === "running" && "animate-pulse")} />
      {label}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  color,
  Icon,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "red" | "orange" | "yellow";
  Icon: React.ElementType;
}) {
  const colorMap = {
    blue: "bg-blue-600/10 text-blue-400",
    green: "bg-green-600/10 text-green-400",
    red: "bg-red-500/10 text-red-400",
    orange: "bg-orange-500/10 text-orange-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
          </div>
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", colorMap[color])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRunsTable({ runs }: { runs: WorkerRun[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No runs yet</p>;
  }
  return (
    <div className="space-y-1">
      {runs.slice(0, 10).map((run, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded",
            run.success ? "bg-green-600/5 border border-green-600/10" : "bg-red-500/5 border border-red-500/10"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {run.success ? (
              <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 text-red-400 shrink-0" />
            )}
            <span className="text-muted-foreground truncate">{timeAgo(run.startedAt)}</span>
            {run.errors.length > 0 && (
              <span className="text-red-400 truncate" title={run.errors.join("; ")}>
                {run.errors[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
            <span>{run.jobsProcessed} jobs</span>
            <span>{formatDuration(run.durationMs)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkerCard({
  worker,
  onRestart,
  isRestarting,
}: {
  worker: WorkerState;
  onRestart: (id: string) => void;
  isRestarting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isProblematic = worker.status === "failed" || worker.isStale;

  return (
    <Card
      className={cn(
        "border-border transition-colors",
        worker.status === "failed" && "border-red-500/30 bg-red-500/5",
        worker.isStale && worker.status !== "failed" && "border-orange-500/30 bg-orange-500/5"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold text-foreground">{worker.name}</CardTitle>
              <StatusBadge status={worker.status} isStale={worker.isStale} />
            </div>
            <CardDescription className="text-xs mt-1">{worker.description}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => onRestart(worker.id)}
            disabled={isRestarting || worker.status === "running"}
            title="Trigger an immediate run"
          >
            {isRestarting ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="text-muted-foreground">Interval</div>
          <div className="text-foreground font-mono">{formatInterval(worker.intervalMs)}</div>

          <div className="text-muted-foreground">Last run</div>
          <div className={cn("font-medium", isProblematic ? "text-orange-400" : "text-foreground")}>
            {timeAgo(worker.lastJobCompletedAt)}
          </div>

          <div className="text-muted-foreground">Jobs total</div>
          <div className="text-foreground">{worker.jobsTotal}</div>

          <div className="text-muted-foreground">Success / Failed</div>
          <div className="flex items-center gap-1">
            <span className="text-green-400">{worker.jobsSucceeded}</span>
            <span className="text-muted-foreground">/</span>
            <span className={cn(worker.jobsFailed > 0 ? "text-red-400" : "text-muted-foreground")}>
              {worker.jobsFailed}
            </span>
          </div>

          {worker.consecutiveFailures > 0 && (
            <>
              <div className="text-muted-foreground">Consecutive fails</div>
              <div className="text-red-400 font-semibold">{worker.consecutiveFailures}</div>
            </>
          )}

          {worker.restartCount > 0 && (
            <>
              <div className="text-muted-foreground">Restarts</div>
              <div className="text-yellow-400">{worker.restartCount} / {worker.maxRestarts}</div>
            </>
          )}
        </div>

        {worker.lastError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 text-xs text-red-400 font-mono break-all">
            {worker.lastError}
          </div>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Recent runs ({worker.recentRuns.length})
        </button>

        {expanded && <RecentRunsTable runs={worker.recentRuns} />}
      </CardContent>
    </Card>
  );
}

export default function WorkersDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [restartingIds, setRestartingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<WorkersResponse>({
    queryKey: ["admin-workers"],
    queryFn: () => apiFetch<WorkersResponse>("/api/admin/workers"),
    refetchInterval: 10_000,
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/workers/${encodeURIComponent(id)}/restart`, {
        method: "POST",
      }),
    onMutate: (id) => {
      setRestartingIds((prev) => new Set(prev).add(id));
    },
    onSettled: (_, __, id) => {
      setRestartingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onSuccess: (_, id) => {
      toast({ title: "Worker triggered", description: `Immediate run triggered for ${id}` });
      void qc.invalidateQueries({ queryKey: ["admin-workers"] });
    },
    onError: (err, id) => {
      toast({
        title: "Restart failed",
        description: `Could not restart ${id}: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive",
      });
    },
  });

  if (user?.role !== "admin") return null;

  const summary = data?.summary;
  const workers = data?.workers ?? [];

  const hasAlerts =
    (summary?.failed ?? 0) > 0 || (summary?.stale ?? 0) > 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Server className="h-6 w-6 text-blue-400" />
              Worker Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage all background workers.
              {dataUpdatedAt > 0 && (
                <span className="ml-2">Last refreshed: {timeAgo(new Date(dataUpdatedAt).toISOString())}</span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void qc.invalidateQueries({ queryKey: ["admin-workers"] })}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {hasAlerts && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {(summary?.failed ?? 0) > 0 &&
                `${summary!.failed} worker${summary!.failed > 1 ? "s" : ""} failed. `}
              {(summary?.stale ?? 0) > 0 &&
                `${summary!.stale} worker${summary!.stale > 1 ? "s" : ""} stale (no jobs processed within threshold). `}
              Check the cards below and trigger a restart if needed.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total" value={summary?.total ?? 0} color="blue" Icon={Server} />
          <SummaryCard label="Running" value={summary?.running ?? 0} color="blue" Icon={Activity} />
          <SummaryCard label="Idle" value={summary?.idle ?? 0} color="green" Icon={CheckCircle2} />
          <SummaryCard label="Failed" value={summary?.failed ?? 0} color="red" Icon={XCircle} />
          <SummaryCard label="Restarting" value={summary?.restarting ?? 0} color="yellow" Icon={RotateCcw} />
          <SummaryCard label="Stale" value={summary?.stale ?? 0} color="orange" Icon={AlertTriangle} />
        </div>

        {isError && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4 pb-3 flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="h-4 w-4 shrink-0" />
              Failed to load worker status. The API server may be unavailable.
            </CardContent>
          </Card>
        )}

        {isLoading && workers.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border animate-pulse">
                <CardContent className="pt-4 pb-4 h-36" />
              </Card>
            ))}
          </div>
        )}

        {workers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                onRestart={(id) => restartMutation.mutate(id)}
                isRestarting={restartingIds.has(worker.id)}
              />
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          Auto-refreshes every 10 seconds. Restart triggers an immediate job run — the scheduled interval continues unaffected.
        </div>
      </div>
    </AppLayout>
  );
}
