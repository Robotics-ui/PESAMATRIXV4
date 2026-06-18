import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api";
async function apiFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
  if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const CATEGORIES = ["forex", "crypto", "indices", "commodities", "market_updates", "economic_events"];
const CATEGORY_LABELS: Record<string, string> = {
  forex: "Forex", crypto: "Crypto", indices: "Indices",
  commodities: "Commodities", market_updates: "Market Updates", economic_events: "Economic Events",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-600/20 text-green-400 border-green-600/30",
  unpublished: "bg-orange-600/20 text-orange-400 border-orange-600/30",
};

interface Article {
  id: number; headline: string; featuredImageUrl: string | null; summary: string | null;
  content: string; category: string; author: string; status: string;
  publishedAt: string | null; createdAt: string;
}

function ArticleDialog({ open, onClose, item, token }: { open: boolean; onClose: () => void; item: Article | null; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    headline: item?.headline ?? "", featuredImageUrl: item?.featuredImageUrl ?? "",
    summary: item?.summary ?? "", content: item?.content ?? "",
    category: item?.category ?? "forex", author: item?.author ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => apiFetch(item ? `/news/${item.id}` : "/news", token, {
      method: item ? "PATCH" : "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => { toast({ title: item ? "Updated" : "Created" }); qc.invalidateQueries({ queryKey: ["admin-news"] }); onClose(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "Edit Article" : "New Article"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Headline *</Label><Input value={form.headline} onChange={(e) => set("headline", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Author *</Label><Input value={form.author} onChange={(e) => set("author", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Featured Image URL</Label><Input value={form.featuredImageUrl} onChange={(e) => set("featuredImageUrl", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Summary</Label><Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={2} placeholder="Brief summary shown in listing..." /></div>
          <div className="space-y-1"><Label>Full Content *</Label><Textarea value={form.content} onChange={(e) => set("content", e.target.value)} rows={8} placeholder="Full article content..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminNewsPage() {
  const { token, user } = useAuth();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [delConfirm, setDelConfirm] = useState<{ item: Article; permanent: boolean } | null>(null);
  const [search, setSearch] = useState("");

  if (user?.role !== "admin") { nav("/dashboard"); return null; }

  const { data: articles = [], isLoading, refetch } = useQuery<Article[]>({
    queryKey: ["admin-news"],
    queryFn: () => apiFetch("/news", token!),
    enabled: !!token,
  });

  const filtered = articles.filter((a) => !search || a.headline.toLowerCase().includes(search.toLowerCase()));

  const publish = (id: number) => apiFetch(`/news/${id}/publish`, token!, { method: "POST" }).then(() => { toast({ title: "Published" }); qc.invalidateQueries({ queryKey: ["admin-news"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const unpublish = (id: number) => apiFetch(`/news/${id}/unpublish`, token!, { method: "POST" }).then(() => { toast({ title: "Unpublished" }); qc.invalidateQueries({ queryKey: ["admin-news"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const doDelete = (item: Article, permanent: boolean) => apiFetch(`/news/${item.id}?permanent=${permanent}`, token!, { method: "DELETE" }).then(() => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-news"] }); setDelConfirm(null); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-blue-400" />
            <div><h1 className="text-xl font-bold text-foreground">Trading News</h1><p className="text-xs text-muted-foreground">Create and manage news articles</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" /> New Article</Button>
          </div>
        </div>

        <Input placeholder="Search articles..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

        {isLoading ? <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div> :
          filtered.length === 0 ? <div className="text-center text-muted-foreground py-12 text-sm">No articles found.</div> :
          <div className="space-y-3">
            {filtered.map((a) => (
              <Card key={a.id} className="border-border">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground text-sm line-clamp-1">{a.headline}</span>
                      <Badge className={`text-xs shrink-0 ${STATUS_BADGE[a.status] ?? ""}`}>{a.status}</Badge>
                      <Badge className="text-xs shrink-0 bg-blue-600/20 text-blue-400 border-blue-600/30">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                    </div>
                    {a.summary && <p className="text-xs text-muted-foreground line-clamp-1">{a.summary}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">By {a.author} &middot; {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => { setEditing(a); setFormOpen(true); }}><Edit className="h-3 w-3" /> Edit</Button>
                    {a.status !== "published" ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-green-400 border-green-600/30" onClick={() => void publish(a.id)}><Eye className="h-3 w-3" /> Publish</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-orange-400 border-orange-600/30" onClick={() => void unpublish(a.id)}><EyeOff className="h-3 w-3" /> Unpublish</Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-400 border-red-600/30" onClick={() => setDelConfirm({ item: a, permanent: false })}><Trash2 className="h-3 w-3" /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </div>

      <ArticleDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} token={token!} />

      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" /> Delete Article</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete "{delConfirm?.item.headline}"?</p>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="perm-news" onChange={(e) => setDelConfirm((d) => d ? { ...d, permanent: e.target.checked } : null)} />
            <label htmlFor="perm-news" className="text-sm text-muted-foreground">Permanently delete</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => delConfirm && void doDelete(delConfirm.item, delConfirm.permanent)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
