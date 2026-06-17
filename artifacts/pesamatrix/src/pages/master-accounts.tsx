import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListMasterAccounts,
  useCreateMasterAccount,
  useDeleteMasterAccount,
  getListMasterAccountsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Server, Plus, Trash2, RefreshCw, AlertCircle, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function MasterAccountsPage() {
  const qc = useQueryClient();
  const { data: accounts, isLoading } = useListMasterAccounts();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ metaapiAccountId: "", mt5Login: "", investorPassword: "", server: "", broker: "" });
  const [error, setError] = useState("");

  const { mutate: create, isPending: creating } = useCreateMasterAccount({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setForm({ metaapiAccountId: "", mt5Login: "", investorPassword: "", server: "", broker: "" });
        void qc.invalidateQueries({ queryKey: getListMasterAccountsQueryKey() });
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? "Failed to create account");
      },
    },
  });

  const { mutate: del } = useDeleteMasterAccount({
    mutation: {
      onSuccess: () => void qc.invalidateQueries({ queryKey: getListMasterAccountsQueryKey() }),
    },
  });

  const statusColor = (s?: string) => {
    if (s === "connected") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "connecting") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (s === "disconnected") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Master Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">Signal provider accounts that strategies are copied from</p>
          </div>
          <Button onClick={() => { setError(""); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Add Master
          </Button>
        </div>

        <Card className="border-blue-600/30 bg-blue-600/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2 text-sm text-blue-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Master accounts are MetaApi accounts acting as signal providers. In live mode, provide your MetaApi account ID. In demo mode, accounts are stored locally.</p>
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
              <Server className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-foreground">No master accounts yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add your first MetaApi master account</p>
              <Button onClick={() => setOpen(true)} className="mt-4 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Add Master Account
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
                      <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                        <Server className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{acc.mt5Login}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {acc.broker} · {acc.server}
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

        {/* Add dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="dark bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add Master Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>MetaApi Account ID <span className="text-muted-foreground text-xs">(optional in demo)</span></Label>
                <Input placeholder="metaapi-account-id" value={form.metaapiAccountId} onChange={(e) => setForm({ ...form, metaapiAccountId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>MT5 Login</Label>
                  <Input placeholder="12345678" value={form.mt5Login} onChange={(e) => setForm({ ...form, mt5Login: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Investor Password</Label>
                  <Input type="password" placeholder="••••••••" value={form.investorPassword} onChange={(e) => setForm({ ...form, investorPassword: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Server</Label>
                  <Input placeholder="ICMarkets-Live" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Broker</Label>
                  <Input placeholder="ICMarkets" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={creating || !form.mt5Login || !form.broker}
                onClick={() => create({ data: { mt5Login: form.mt5Login, investorPassword: form.investorPassword, server: form.server, broker: form.broker } })}
              >
                {creating ? "Adding..." : "Add Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="dark bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Master Account?</AlertDialogTitle>
              <AlertDialogDescription>This will remove the account and all associated strategies. This cannot be undone.</AlertDialogDescription>
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
