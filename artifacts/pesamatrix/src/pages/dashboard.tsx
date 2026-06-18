import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardSummary, useGetMySubscription, useGetAdminSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Server,
  Users,
  GitBranch,
  Link2,
  Calendar,
  CreditCard,
  Clock,
  Activity,
  AlertCircle,
} from "lucide-react";

interface CriticalAnnouncement {
  id: number; title: string; message: string; priority: string;
}

function CriticalAnnouncementBanner({ token }: { token: string | null }) {
  const { data: announcements = [] } = useQuery<CriticalAnnouncement[]>({
    queryKey: ["announcements-critical"],
    queryFn: async () => {
      const res = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return (res.json() as Promise<CriticalAnnouncement[]>);
    },
    enabled: !!token,
    select: (data) => data.filter((a) => a.priority === "critical"),
  });

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2">
      {announcements.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-lg border border-red-600/40 bg-red-600/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-red-300 text-sm">{a.title}: </span>
            <span className="text-sm text-red-200/80 line-clamp-2">{a.message}</span>
          </div>
          <Link href="/announcements">
            <span className="text-xs text-red-400 underline shrink-0 cursor-pointer">View all</span>
          </Link>
        </div>
      ))}
    </div>
  );
}

function SubscriptionCountdown({ endDate, daysLeft }: { endDate?: string | null; daysLeft?: number | null }) {
  if (!endDate || !daysLeft || daysLeft <= 0) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-400">No Active Subscription</p>
              <p className="text-xs text-muted-foreground mt-1">Subscribe to start copy trading</p>
            </div>
            <Link href="/payment">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Subscribe Now</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const end = new Date(endDate);
  const urgent = daysLeft <= 2;

  return (
    <Card className={`border-${urgent ? "orange" : "green"}-500/30 bg-${urgent ? "orange" : "green"}-500/5`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${urgent ? "bg-orange-500/20" : "bg-green-500/20"}`}>
              <Clock className={`h-5 w-5 ${urgent ? "text-orange-400" : "text-green-400"}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${urgent ? "text-orange-400" : "text-green-400"}`}>
                {daysLeft} trading day{daysLeft !== 1 ? "s" : ""} remaining
              </p>
              <p className="text-xs text-muted-foreground">Expires {end.toLocaleDateString()}</p>
            </div>
          </div>
          <Link href="/payment">
            <Button size="sm" variant="outline" className={urgent ? "border-orange-500/40 text-orange-400" : "border-green-500/40 text-green-400"}>
              {urgent ? "Renew Now" : "Top Up"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: subscription } = useGetMySubscription();
  const { data: settings } = useGetAdminSettings();

  const dailyFee = settings?.dailyFee ?? 100;
  const minDays = settings?.minDays ?? 1;
  const maxDays = settings?.maxDays ?? 365;

  const stats = [
    { label: "Master Accounts", value: summary?.masterAccounts ?? 0, icon: Server, color: "blue" },
    { label: "Slave Accounts", value: summary?.slaveAccounts ?? 0, icon: Users, color: "blue" },
    { label: "Strategies", value: summary?.strategies ?? 0, icon: GitBranch, color: "green" },
    { label: "Active Bindings", value: summary?.activeBindings ?? 0, icon: Link2, color: "green" },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">Here&apos;s your trading overview</p>
        </div>

        {/* Critical announcements */}
        <CriticalAnnouncementBanner token={token} />

        {/* Subscription status */}
        <SubscriptionCountdown
          endDate={subscription?.endDate}
          daysLeft={subscription?.remainingTradingDays}
        />

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {isLoading ? "—" : value}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg bg-${color}-600/10 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 text-${color}-400`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent trade performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Copy Trading Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.activeBindings ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active bindings</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{summary.activeBindings} active</Badge>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min((summary.activeBindings / Math.max(summary.slaveAccounts || 1, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.activeBindings} of {summary.slaveAccounts} slave accounts actively copying
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <Link2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No active bindings yet</p>
                  <Link href="/bindings">
                    <Button size="sm" variant="outline" className="mt-2">Set up bindings</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-400" />
                Subscription Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Pricing info — always visible */}
              <div className="mb-3 pb-3 border-b border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-blue-400 font-semibold">KES {dailyFee.toFixed(0)} / trading day</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Plans available</span>
                  <span className="text-foreground">{minDays}–{maxDays} days</span>
                </div>
              </div>
              {subscription ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      className={
                        subscription.status === "active"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                  {subscription.startDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Started</span>
                      <span className="text-foreground">{new Date(subscription.startDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {subscription.endDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="text-foreground">{new Date(subscription.endDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {subscription.daysPaid != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days paid</span>
                      <span className="text-foreground">{subscription.daysPaid} trading days</span>
                    </div>
                  )}
                  {subscription.daysPaid != null && (
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Total paid</span>
                      <span className="text-foreground">KES {(subscription.daysPaid * dailyFee).toFixed(0)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center space-y-2">
                  <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No active subscription</p>
                  <Link href="/payment">
                    <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700">Subscribe Now</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent trade logs */}
        {summary?.recentTradeLogs && summary.recentTradeLogs.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Recent Trade Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.recentTradeLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                      {log.details && (
                        <span className="text-muted-foreground text-xs truncate max-w-[200px]">{log.details}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
