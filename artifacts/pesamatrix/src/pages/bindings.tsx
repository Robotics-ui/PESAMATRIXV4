import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListBindings,
  useCreateBinding,
  useDeleteBinding,
  useListStrategies,
  useListSlaveAccounts,
  getListBindingsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link2, Plus, Trash2, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function BindingsPage() {
  const qc = useQueryClient();
  const { data: bindings, isLoading } = useListBindings();
  const { data: strategies } = useListStrategies();
  const { data: slaveAccounts } = useListSlaveAccounts();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ strategyId: 0, slaveAccountId: 0, multiplier: 1.0 });
  const [error, setError] = useState("");

  const { mutate: create, isPending: creating } = useCreateBinding({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setForm({ strategyId: 0, slaveAccountId: 0, multiplier: 1.0 });
        qc.invalidateQueries({ queryKey: getListBindingsQueryKey() });
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? "Failed to create binding");
      },
    },
  });

  const { mutate: del } = useDeleteBinding({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListBindingsQueryKey() }),
    },
  });

  const statusColor = (s?: string) => {
    if (s === "active") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "suspended") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  const canCreate = !!(strategies?.length && slaveAccounts?.length);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bindings</h1>
            <p className="text-sm text-muted-foreground mt-1">Connect slave accounts to strategies for copy trading</p>
          </div>
          <Button onClick={() => { setError(""); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700" disabled={!canCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Binding
          </Button>
        </div>

        {!canCreate && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-orange-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>You need at least one strategy and one slave account before creating bindings.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !bindings?.length ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-foreground">No bindings yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Bind a slave account to a strategy to start copying</p>
              <Button onClick={() => setOpen(true)} className="mt-4 bg-blue-600 hover:bg-blue-700" disabled={!canCreate}>
                <Plus className="h-4 w-4 mr-2" /> Create Binding
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bindings.map((b) => {
              const strategy = strategies?.find((s) => s.id === b.strategyId);
              const slave = slaveAccounts?.find((s) => s.id === b.slaveAccountId);
              return (
                <Card key={b.id} className="border-border hover:border-blue-600/30 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                          <Link2 className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground">Strategy</span>
                            <span className="text-sm font-medium text-foreground truncate">{strategy?.name ?? `#${b.strategyId}`}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs text-muted-foreground">Slave</span>
                            <span className="text-sm font-medium text-foreground truncate">{slave?.name ?? `#${b.slaveAccountId}`}</span>
                          </div>
                          {b.multiplier != null && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">{b.multiplier}×</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge className={statusColor(b.status ?? undefined)}>{b.status ?? "pending"}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(b.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="dark bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Binding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Strategy</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.strategyId}
                  onChange={(e) => setForm({ ...form, strategyId: parseInt(e.target.value) })}
                >
                  <option value={0}>Select strategy...</option>
                  {strategies?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Slave Account</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.slaveAccountId}
                  onChange={(e) => setForm({ ...form, slaveAccountId: parseInt(e.target.value) })}
                >
                  <option value={0}>Select slave account...</option>
                  {slaveAccounts?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Lot Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={form.multiplier}
                  onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">1.0 = copy same lot size as master</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={creating || !form.strategyId || !form.slaveAccountId}
                onClick={() => create({ data: { strategyId: form.strategyId, slaveAccountId: form.slaveAccountId, multiplier: form.multiplier } })}
              >
                {creating ? "Creating..." : "Create Binding"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="dark bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Binding?</AlertDialogTitle>
              <AlertDialogDescription>This will stop copy trading for this slave account. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => { if (deleteId) del({ id: deleteId }); setDeleteId(null); }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
