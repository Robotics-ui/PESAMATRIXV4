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
import { Bell, Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
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

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-600/20 text-green-400 border-green-600/30",
  unpublished: "bg-orange-600/20 text-orange-400 border-orange-600/30",
};
const PRIORITY_BADGE: Record<string, string> = {
  normal: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  important: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  critical: "bg-red-600/20 text-red-400 border-red-600/30",
};

interface Announcement {
  id: number; title: string; message: string; imageUrl: string | null;
  priority: string; status: string; publishedAt: string | null; createdAt: string;
}

function AnnouncementDialog({ open, onClose, item, token }: { open: boolean; onClose: () => void; item: Announcement | null; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: item?.title ?? "", message: item?.message ?? "",
    imageUrl: item?.imageUrl ?? "", priority: item?.priority ?? "normal",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => apiFetch(item ? `/announcements/${item.id}` : "/announcements", token, {
      method: item ? "PATCH" : "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => { toast({ title: item ? "Updated" : "Created" }); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); onClose(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Image URL (optional)</Label><Input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Message *</Label><Textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={5} placeholder="Announcement message..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAnnouncementsPage() {
  const { token, user } = useAuth();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [delConfirm, setDelConfirm] = useState<{ item: Announcement; permanent: boolean } | null>(null);

  if (user?.role !== "admin") { nav("/dashboard"); return null; }

  const { data: announcements = [], isLoading, refetch } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => apiFetch("/announcements", token!),
    enabled: !!token,
  });

  const publish = (id: number) => apiFetch(`/announcements/${id}/publish`, token!, { method: "POST" }).then(() => { toast({ title: "Published" }); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const unpublish = (id: number) => apiFetch(`/announcements/${id}/unpublish`, token!, { method: "POST" }).then(() => { toast({ title: "Unpublished" }); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const doDelete = (item: Announcement, permanent: boolean) => apiFetch(`/announcements/${item.id}?permanent=${permanent}`, token!, { method: "DELETE" }).then(() => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); setDelConfirm(null); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-blue-400" />
            <div><h1 className="text-xl font-bold text-foreground">Announcements</h1><p className="text-xs text-muted-foreground">Manage platform announcements</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" /> New Announcement</Button>
          </div>
        </div>

        {isLoading ? <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div> :
          announcements.length === 0 ? <div className="text-center text-muted-foreground py-12 text-sm">No announcements yet.</div> :
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id} className="border-border">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground text-sm">{a.title}</span>
                      <Badge className={`text-xs shrink-0 ${STATUS_BADGE[a.status] ?? ""}`}>{a.status}</Badge>
                      <Badge className={`text-xs shrink-0 capitalize ${PRIORITY_BADGE[a.priority] ?? ""}`}>{a.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleDateString()}</p>
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

      <AnnouncementDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} token={token!} />

      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" /> Delete Announcement</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete "{delConfirm?.item.title}"?</p>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="perm-ann" onChange={(e) => setDelConfirm((d) => d ? { ...d, permanent: e.target.checked } : null)} />
            <label htmlFor="perm-ann" className="text-sm text-muted-foreground">Permanently delete</label>
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
