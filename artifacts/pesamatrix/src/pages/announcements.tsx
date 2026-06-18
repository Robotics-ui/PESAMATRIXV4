import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, RefreshCw, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Announcement {
  id: number; title: string; message: string; imageUrl: string | null;
  priority: string; status: string; publishedAt: string | null; createdAt: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; icon: React.ElementType; border: string; badge: string }> = {
  critical: { label: "Critical", icon: AlertCircle, border: "border-red-600/40 bg-red-600/5", badge: "bg-red-600/20 text-red-400 border-red-600/30" },
  important: { label: "Important", icon: AlertTriangle, border: "border-orange-600/40 bg-orange-600/5", badge: "bg-orange-600/20 text-orange-400 border-orange-600/30" },
  normal: { label: "Normal", icon: Info, border: "border-border", badge: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
};

export default function AnnouncementsPage() {
  const { token } = useAuth();

  const { data: announcements = [], isLoading, refetch } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load announcements");
      return res.json() as Promise<Announcement[]>;
    },
    enabled: !!token,
  });

  const sorted = [...announcements].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, important: 1, normal: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-bold text-foreground">Announcements</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refetch()} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No announcements at this time.</div>
        ) : (
          <div className="space-y-4">
            {sorted.map((a) => {
              const cfg = PRIORITY_CONFIG[a.priority] ?? PRIORITY_CONFIG.normal;
              const Icon = cfg.icon;
              return (
                <Card key={a.id} className={`border ${cfg.border}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{a.title}</h3>
                          <Badge className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
                        </div>
                        {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="w-full max-h-48 object-cover rounded-md mb-3" />}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{a.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
