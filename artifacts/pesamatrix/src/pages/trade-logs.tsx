import { AppLayout } from "@/components/layout/app-layout";
import { useListTradeLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, BarChart3, Activity } from "lucide-react";

export default function TradeLogsPage() {
  const { data: logs, isLoading } = useListTradeLogs();

  const totalLogs = logs?.length ?? 0;
  const recentToday = logs?.filter((l) => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">History of all copy trading activity</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalLogs}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{recentToday}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{totalLogs > 0 ? "Active" : "Idle"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !logs?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground">No activity yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Events will appear here once copy trading is active</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Action</th>
                      <th className="text-left py-2 pr-4">Details</th>
                      <th className="text-left py-2 pr-4">Strategy</th>
                      <th className="text-right py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground max-w-[240px] truncate">
                          {log.details ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground font-mono">
                          #{log.strategyId}
                        </td>
                        <td className="py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
