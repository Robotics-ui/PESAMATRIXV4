import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const token = () => localStorage.getItem("auth_token") ?? "";

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

type Prefs = {
  userId?: number;
  tradeAlerts: boolean;
  subscriptionAlerts: boolean;
  announcements: boolean;
};

const PREFERENCES = [
  {
    key: "subscriptionAlerts" as const,
    label: "Subscription Alerts",
    description: "SMS notifications when your subscription is activated, expiring, or expired",
  },
  {
    key: "tradeAlerts" as const,
    label: "Trade Alerts",
    description: "SMS notifications about copy trading activity on your accounts",
  },
  {
    key: "announcements" as const,
    label: "Announcements",
    description: "Receive platform-wide announcements and broadcast messages",
  },
];

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery<Prefs>({
    queryKey: ["sms-preferences"],
    queryFn: () => apiFetch("/api/sms/preferences"),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Prefs>) =>
      apiFetch<Prefs>("/api/sms/preferences", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Preferences saved" });
      qc.invalidateQueries({ queryKey: ["sms-preferences"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function toggle(key: keyof Prefs) {
    if (!prefs) return;
    updateMutation.mutate({ [key]: !prefs[key] });
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notification Preferences</h1>
            <p className="text-sm text-muted-foreground">Control which SMS notifications you receive</p>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">SMS Notifications</CardTitle>
            <CardDescription>
              Notifications are sent to your registered phone number. Billing and payment confirmations are always sent regardless of these settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading preferences...</div>
            ) : (
              PREFERENCES.map(({ key, label, description }, i) => (
                <div
                  key={key}
                  className={`flex items-center justify-between py-4 ${i < PREFERENCES.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={prefs?.[key] ?? true}
                    onCheckedChange={() => toggle(key)}
                    disabled={updateMutation.isPending}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              All SMS notifications are sent through PESAMATRIX's bulk SMS system. Standard rates apply. Billing confirmations and account security alerts are mandatory and cannot be disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
