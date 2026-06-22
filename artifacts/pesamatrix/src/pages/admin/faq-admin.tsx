import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle, Plus, Pencil, Trash2, RefreshCw, ChevronUp, ChevronDown,
  Eye, EyeOff, TrendingUp, Search, BarChart3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const FAQ_CATEGORIES = [
  "Getting Started",
  "Subscriptions",
  "Payments",
  "M-Pesa",
  "Master Accounts",
  "Slave Accounts",
  "Copy Trading",
  "MetaApi Connection",
  "Promotions & Referrals",
  "Security",
  "Technical Support",
];

interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  status: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Analytics {
  topViewed: Faq[];
  topSearches: Array<{ searchTerm: string; count: number }>;
}

async function apiFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

const EMPTY_FORM = { question: "", answer: "", category: "Getting Started", sortOrder: 0, status: "draft" as "draft" | "published" };

function FaqDialog({
  open, onClose, item, token,
}: { open: boolean; onClose: () => void; item: Faq | null; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    question: item?.question ?? "",
    answer: item?.answer ?? "",
    category: item?.category ?? "Getting Started",
    sortOrder: item?.sortOrder ?? 0,
    status: (item?.status ?? "draft") as "draft" | "published",
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(item ? `/faqs/${item.id}` : "/faqs", token, {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast({ title: item ? "FAQ updated" : "FAQ created" });
      void qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit FAQ" : "New FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Question</Label>
            <Input
              placeholder="Enter the question..."
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Answer</Label>
            <Textarea
              placeholder="Enter the full answer..."
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              rows={6}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAQ_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "draft" | "published" }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            disabled={save.isPending || !form.question.trim() || !form.answer.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving..." : item ? "Save Changes" : "Create FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminFaqPage() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  if (user && user.role !== "admin") { navigate("/dashboard"); return null; }

  const [dialogItem, setDialogItem] = useState<Faq | null | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: faqs = [], isLoading, refetch } = useQuery<Faq[]>({
    queryKey: ["admin-faqs"],
    queryFn: () => apiFetch("/admin/faqs", token ?? "") as Promise<Faq[]>,
    enabled: !!token,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["faq-analytics"],
    queryFn: () => apiFetch("/admin/faq-analytics", token ?? "") as Promise<Analytics>,
    enabled: !!token,
    staleTime: 60_000,
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/faqs/${id}`, token ?? "", { method: "DELETE" }),
    onSuccess: () => { toast({ title: "FAQ deleted" }); void qc.invalidateQueries({ queryKey: ["admin-faqs"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/faqs/${id}`, token ?? "", { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-faqs"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: (items: Array<{ id: number; sortOrder: number }>) =>
      apiFetch("/faqs/reorder", token ?? "", { method: "PATCH", body: JSON.stringify(items) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-faqs"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function moveItem(id: number, direction: "up" | "down") {
    const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const idx = sorted.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newOrder = sorted.map((f, i) => {
      if (i === idx) return { id: f.id, sortOrder: sorted[swapIdx].sortOrder };
      if (i === swapIdx) return { id: f.id, sortOrder: sorted[idx].sortOrder };
      return { id: f.id, sortOrder: f.sortOrder };
    });
    reorder.mutate(newOrder);
  }

  const displayed = faqs
    .filter((f) => {
      if (filterCat !== "All" && f.category !== filterCat) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const STATUS_BADGE: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    published: "bg-green-600/20 text-green-400 border-green-600/30",
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-foreground">FAQ Management</h1>
              <p className="text-sm text-muted-foreground">Manage frequently asked questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => void refetch()} className="text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setDialogItem(null)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> New FAQ
            </Button>
          </div>
        </div>

        <Tabs defaultValue="faqs">
          <TabsList>
            <TabsTrigger value="faqs" className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> FAQs ({faqs.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
          </TabsList>

          {/* ── FAQ List Tab ── */}
          <TabsContent value="faqs" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-center">
              <select
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="All">All Categories</option>
                {FAQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <span className="text-xs text-muted-foreground ml-auto">{displayed.length} shown</span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayed.length === 0 ? (
              <Card className="border-border">
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-medium text-foreground">No FAQs yet</p>
                  <Button onClick={() => setDialogItem(null)} className="mt-4 bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" /> Create First FAQ
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {displayed.map((faq, idx) => (
                  <Card key={faq.id} className="border-border hover:border-blue-600/20 transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        {/* Reorder controls */}
                        <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
                          <button
                            onClick={() => moveItem(faq.id, "up")}
                            disabled={idx === 0 || reorder.isPending}
                            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveItem(faq.id, "down")}
                            disabled={idx === displayed.length - 1 || reorder.isPending}
                            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug truncate">{faq.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{faq.answer}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">{faq.category}</Badge>
                            <Badge className={`text-xs ${STATUS_BADGE[faq.status] ?? STATUS_BADGE.draft}`}>
                              {faq.status}
                            </Badge>
                            {faq.viewCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3" /> {faq.viewCount} views
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">sort: {faq.sortOrder}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title={faq.status === "published" ? "Unpublish" : "Publish"}
                            onClick={() => toggleStatus.mutate({ id: faq.id, status: faq.status === "published" ? "draft" : "published" })}
                          >
                            {faq.status === "published"
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-blue-400"
                            onClick={() => setDialogItem(faq)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(faq.id)}
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
          </TabsContent>

          {/* ── Analytics Tab ── */}
          <TabsContent value="analytics" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Viewed */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-400" /> Most Viewed FAQs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!analytics?.topViewed?.length ? (
                    <p className="text-sm text-muted-foreground">No view data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topViewed.map((f, i) => (
                        <div key={f.id} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{f.question}</p>
                            <p className="text-xs text-muted-foreground">{f.category}</p>
                          </div>
                          <span className="text-xs text-blue-400 font-semibold shrink-0">{f.viewCount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Searches */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4 text-green-400" /> Top Search Terms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!analytics?.topSearches?.length ? (
                    <p className="text-sm text-muted-foreground">No search data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topSearches.map((s, i) => (
                        <div key={s.searchTerm} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                          <p className="text-xs font-medium text-foreground flex-1 truncate">{s.searchTerm}</p>
                          <span className="text-xs text-green-400 font-semibold shrink-0">{s.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total FAQs", value: faqs.length },
                { label: "Published", value: faqs.filter((f) => f.status === "published").length },
                { label: "Drafts", value: faqs.filter((f) => f.status === "draft").length },
                { label: "Total Views", value: faqs.reduce((s, f) => s + f.viewCount, 0) },
              ].map(({ label, value }) => (
                <Card key={label} className="border-border">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        {dialogItem !== undefined && (
          <FaqDialog
            open={true}
            onClose={() => setDialogItem(undefined)}
            item={dialogItem}
            token={token ?? ""}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the FAQ and its view history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => { if (deleteId) del.mutate(deleteId); setDeleteId(null); }}
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
