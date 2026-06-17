import { AppLayout } from "@/components/layout/app-layout";
import { useListTradeLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, BarChart3, TrendingUp, TrendingDown } from "lucide-react";

export default function TradeLogsPage() {
  const { data: logs, isLoading } = useListTradeLogs();

  const totalProfit = logs?.reduce((sum, l) => sum + parseFloat(l.profit ?? "0"), 0) ?? 0;
  const wins = logs?.filter((l) => parseFloat(l.profit ?? "0") > 0).length ?? 0;
  const losses = logs?.filter((l) => parseFloat(l.profit ?? "0") < 0).length ?? 0;
  const winRate = (logs?.length ?? 0) > 0 ? Math.round((wins / logs!.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">History of all copied trades</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total Trades</p>
              <p className="text-2xl font-bold text-foreground mt-1">{logs?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{winRate}%</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Wins / Losses</p>
              <p className="text-2xl font-bold mt-1">
                <span className="text-green-400">{wins}</span>
                <span className="text-muted-foreground text-lg"> / </span>
                <span className="text-red-400">{losses}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total P/L</p>
              <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Trade History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !logs?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground">No trades yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Trades will appear here once copy trading is active</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Symbol</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-right py-2 pr-4">Volume</th>
                      <th className="text-right py-2 pr-4">Open</th>
                      <th className="text-right py-2 pr-4">Close</th>
                      <th className="text-right py-2 pr-4">P/L</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-right py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const profit = parseFloat(log.profit ?? "0");
                      const isWin = profit > 0;
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-3 pr-4 font-semibold text-foreground">{log.symbol}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${log.type === "buy" ? "text-green-400" : "text-red-400"}`}>
                              {log.type === "buy" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {log.type?.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right text-foreground">{log.volume}</td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">{log.openPrice}</td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">{log.closePrice ?? "—"}</td>
                          <td className={`py-3 pr-4 text-right font-semibold ${isWin ? "text-green-400" : profit < 0 ? "text-red-400" : "text-foreground"}`}>
                            {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                          </td>
                          <td className="py-3">
                            <Badge className={
                              log.status === "closed"
                                ? "bg-muted/50 text-muted-foreground border-muted"
                                : "bg-green-500/20 text-green-400 border-green-500/30"
                            }>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right text-xs text-muted-foreground">
                            {log.openTime ? new Date(log.openTime).toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
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
