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
import { BookOpen, Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
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

const CATEGORIES = ["beginner", "technical_analysis", "fundamental_analysis", "risk_management", "psychology", "mt4_tutorials", "mt5_tutorials", "copy_trading"];
const CATEGORY_LABELS: Record<string, string> = {
  beginner: "Beginner Trading", technical_analysis: "Technical Analysis",
  fundamental_analysis: "Fundamental Analysis", risk_management: "Risk Management",
  psychology: "Psychology", mt4_tutorials: "MT4 Tutorials", mt5_tutorials: "MT5 Tutorials", copy_trading: "Copy Trading",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-600/20 text-green-400 border-green-600/30",
  unpublished: "bg-orange-600/20 text-orange-400 border-orange-600/30",
};

interface Resource {
  id: number; title: string; description: string | null; category: string;
  resourceType: string; url: string; thumbnailUrl: string | null;
  status: string; publishedAt: string | null; createdAt: string;
}

function ResourceDialog({ open, onClose, item, token }: { open: boolean; onClose: () => void; item: Resource | null; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: item?.title ?? "", description: item?.description ?? "",
    category: item?.category ?? "beginner", resourceType: item?.resourceType ?? "link",
    url: item?.url ?? "", thumbnailUrl: item?.thumbnailUrl ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => apiFetch(item ? `/resources/${item.id}` : "/resources", token, {
      method: item ? "PATCH" : "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => { toast({ title: item ? "Updated" : "Created" }); qc.invalidateQueries({ queryKey: ["admin-resources"] }); onClose(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit Resource" : "Add Resource"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Type *</Label>
              <Select value={form.resourceType} onValueChange={(v) => set("resourceType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">External Link</SelectItem>
                  <SelectItem value="video_link">Video (YouTube/Vimeo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>URL *</Label><Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Thumbnail URL</Label><Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminResourcesPage() {
  const { token, user } = useAuth();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [delConfirm, setDelConfirm] = useState<{ item: Resource; permanent: boolean } | null>(null);
  const [search, setSearch] = useState("");

  if (user?.role !== "admin") { nav("/dashboard"); return null; }

  const { data: resources = [], isLoading, refetch } = useQuery<Resource[]>({
    queryKey: ["admin-resources"],
    queryFn: () => apiFetch("/resources", token!),
    enabled: !!token,
  });

  const filtered = resources.filter((r) => !search || r.title.toLowerCase().includes(search.toLowerCase()));

  const publish = (id: number) => apiFetch(`/resources/${id}/publish`, token!, { method: "POST" }).then(() => { toast({ title: "Published" }); qc.invalidateQueries({ queryKey: ["admin-resources"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const unpublish = (id: number) => apiFetch(`/resources/${id}/unpublish`, token!, { method: "POST" }).then(() => { toast({ title: "Unpublished" }); qc.invalidateQueries({ queryKey: ["admin-resources"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const doDelete = (item: Resource, permanent: boolean) => apiFetch(`/resources/${item.id}?permanent=${permanent}`, token!, { method: "DELETE" }).then(() => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-resources"] }); setDelConfirm(null); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-green-400" />
            <div><h1 className="text-xl font-bold text-foreground">Learning Resources</h1><p className="text-xs text-muted-foreground">Manage trading resources and links</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-green-600 hover:bg-green-700 gap-2"><Plus className="h-4 w-4" /> Add Resource</Button>
          </div>
        </div>

        <Input placeholder="Search resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

        {isLoading ? <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div> :
          filtered.length === 0 ? <div className="text-center text-muted-foreground py-12 text-sm">No resources found.</div> :
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{r.title}</span>
                      <Badge className={`text-xs shrink-0 ${STATUS_BADGE[r.status] ?? ""}`}>{r.status}</Badge>
                      <Badge className="text-xs shrink-0 bg-green-600/20 text-green-400 border-green-600/30">{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                      <Badge variant="outline" className="text-xs capitalize shrink-0">{r.resourceType === "video_link" ? "Video" : "Link"}</Badge>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{r.url}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => { setEditing(r); setFormOpen(true); }}><Edit className="h-3 w-3" /> Edit</Button>
                    {r.status !== "published" ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-green-400 border-green-600/30" onClick={() => void publish(r.id)}><Eye className="h-3 w-3" /> Publish</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-orange-400 border-orange-600/30" onClick={() => void unpublish(r.id)}><EyeOff className="h-3 w-3" /> Unpublish</Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-400 border-red-600/30" onClick={() => setDelConfirm({ item: r, permanent: false })}><Trash2 className="h-3 w-3" /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </div>

      <ResourceDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} token={token!} />

      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" /> Delete Resource</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete "{delConfirm?.item.title}"?</p>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="perm-res" onChange={(e) => setDelConfirm((d) => d ? { ...d, permanent: e.target.checked } : null)} />
            <label htmlFor="perm-res" className="text-sm text-muted-foreground">Permanently delete</label>
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
