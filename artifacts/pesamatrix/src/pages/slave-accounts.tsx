import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListSlaveAccounts,
  useCreateSlaveAccount,
  useDeleteSlaveAccount,
  getListSlaveAccountsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, Trash2, RefreshCw, AlertCircle, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SlaveAccountsPage() {
  const qc = useQueryClient();
  const { data: accounts, isLoading } = useListSlaveAccounts();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", metaapiAccountId: "", login: "", password: "", server: "", platform: "mt4" });
  const [error, setError] = useState("");

  const { mutate: create, isPending: creating } = useCreateSlaveAccount({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", metaapiAccountId: "", login: "", password: "", server: "", platform: "mt4" });
        qc.invalidateQueries({ queryKey: getListSlaveAccountsQueryKey() });
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? "Failed to create account");
      },
    },
  });

  const { mutate: del } = useDeleteSlaveAccount({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSlaveAccountsQueryKey() }),
    },
  });

  const statusColor = (s?: string) => {
    if (s === "active" || s === "deployed") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "suspended") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (s === "connecting") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Slave Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">Follower accounts that copy trades from master accounts</p>
          </div>
          <Button onClick={() => { setError(""); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Add Slave
          </Button>
        </div>

        <Card className="border-blue-600/30 bg-blue-600/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2 text-sm text-blue-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Slave accounts follow master accounts via CopyFactory bindings. They are auto-suspended when your subscription expires.</p>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !accounts?.length ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-foreground">No slave accounts yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add accounts that will copy trades</p>
              <Button onClick={() => setOpen(true)} className="mt-4 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Add Slave Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id} className="border-border hover:border-blue-600/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-green-600/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{acc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {acc.login} · {acc.server} · {acc.platform?.toUpperCase()}
                        </p>
                        {acc.metaapiAccountId && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {acc.metaapiAccountId}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusColor(acc.status)}>{acc.status ?? "pending"}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(acc.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="dark bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add Slave Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="My Slave Account" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>MetaApi Account ID <span className="text-muted-foreground text-xs">(optional in demo)</span></Label>
                <Input placeholder="metaapi-account-id" value={form.metaapiAccountId} onChange={(e) => setForm({ ...form, metaapiAccountId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>MT Login</Label>
                  <Input placeholder="12345678" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>MT Password</Label>
                  <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Server</Label>
                  <Input placeholder="ICMarkets-Live" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  >
                    <option value="mt4">MT4</option>
                    <option value="mt5">MT5</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={creating || !form.name}
                onClick={() => create({ data: form as Parameters<typeof create>[0]["data"] })}
              >
                {creating ? "Adding..." : "Add Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="dark bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Slave Account?</AlertDialogTitle>
              <AlertDialogDescription>This will remove the account and all associated bindings. This cannot be undone.</AlertDialogDescription>
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
