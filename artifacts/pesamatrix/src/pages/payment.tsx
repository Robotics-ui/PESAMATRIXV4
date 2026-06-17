import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useInitiatePayment, useListPayments, useGetAdminSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Smartphone, Clock, CreditCard, Info } from "lucide-react";

const PRESET_DAYS = [1, 5, 10, 20, 30];

function isTradingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function addTradingDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isTradingDay(result)) added++;
  }
  return result;
}

function getExpiryDate(days: number): string {
  const end = addTradingDays(new Date(), days);
  return end.toLocaleDateString("en-KE", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function PaymentPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(5);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const { data: settings } = useGetAdminSettings();
  const { data: payments } = useListPayments();
  const dailyFee = parseFloat(settings?.dailyFee ?? "100");
  const totalAmount = days * dailyFee;

  const { mutate, isPending } = useInitiatePayment({
    mutation: {
      onSuccess: (data) => {
        setStatus("pending");
        setMessage(data.message ?? "STK Push sent to your phone. Enter your M-Pesa PIN to complete.");
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setStatus("error");
        setMessage(e?.data?.error ?? "Payment failed. Please try again.");
      },
    },
  });

  const handlePay = () => {
    setStatus("idle");
    mutate({ data: { phone, days } });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscribe</h1>
          <p className="text-sm text-muted-foreground mt-1">Pay via M-Pesa STK Push to activate copy trading</p>
        </div>

        {/* Pricing info */}
        <Card className="border-blue-600/30 bg-blue-600/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-400">KES {dailyFee.toFixed(0)} per trading day</p>
                <p className="text-xs text-muted-foreground">Weekends and public holidays are not counted. Subscription runs on trading days only.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-green-400" />
              M-Pesa Payment
            </CardTitle>
            <CardDescription>Enter your M-Pesa number and select trading days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <Input
                id="phone"
                placeholder="254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Format: 254XXXXXXXXX</p>
            </div>

            {/* Days selection */}
            <div className="space-y-3">
              <Label>Trading Days</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      days === d
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-border text-muted-foreground hover:border-blue-600/50 hover:text-foreground"
                    }`}
                  >
                    {d} day{d !== 1 ? "s" : ""}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={settings?.minDays ?? 1}
                  max={settings?.maxDays ?? 365}
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">custom days</span>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trading days</span>
                <span className="text-foreground font-medium">{days} day{days !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate</span>
                <span className="text-foreground">KES {dailyFee.toFixed(0)} / day</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expires approximately
                </span>
                <span className="text-foreground">{getExpiryDate(days)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-lg text-blue-400">KES {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Status messages */}
            {status === "pending" && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <Smartphone className="h-5 w-5 text-green-400 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <p className="text-sm font-medium text-green-400">STK Push Sent!</p>
                  <p className="text-xs text-muted-foreground mt-1">{message}</p>
                </div>
              </div>
            )}
            {status === "success" && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-400">Payment Confirmed!</p>
                  <p className="text-xs text-muted-foreground mt-1">{message}</p>
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Payment Failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{message}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handlePay}
              disabled={isPending || !phone || days < 1}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isPending ? "Processing..." : `Pay KES ${totalAmount.toFixed(2)} via M-Pesa`}
            </Button>
          </CardContent>
        </Card>

        {/* Payment history */}
        {payments && payments.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">KES {parseFloat(p.amount ?? "0").toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{p.mpesaReceipt ?? "Pending"} · {p.days} trading days</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={
                          p.status === "completed"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : p.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }
                      >
                        {p.status}
                      </Badge>
                      {p.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleDateString()}</p>
                      )}
                    </div>
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
