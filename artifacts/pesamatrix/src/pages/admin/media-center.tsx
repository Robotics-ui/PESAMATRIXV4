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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Video, Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
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

interface MediaItem {
  id: number; title: string; description: string | null; mediaType: string;
  url: string; thumbnailUrl: string | null; category: string | null;
  status: string; publishedAt: string | null; createdAt: string;
}

const MEDIA_TYPES = [
  { value: "image_url", label: "Image URL" },
  { value: "video_url", label: "Video URL" },
  { value: "video_link", label: "YouTube / Vimeo Link" },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-600/20 text-green-400 border-green-600/30",
  unpublished: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  deleted: "bg-red-600/20 text-red-400 border-red-600/30",
};

function FormDialog({ open, onClose, item, token }: { open: boolean; onClose: () => void; item: MediaItem | null; token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: item?.title ?? "", description: item?.description ?? "",
    mediaType: item?.mediaType ?? "image_url", url: item?.url ?? "",
    thumbnailUrl: item?.thumbnailUrl ?? "", category: item?.category ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => apiFetch(item ? `/media/${item.id}` : "/media", token, {
      method: item ? "PATCH" : "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => { toast({ title: item ? "Updated" : "Created" }); qc.invalidateQueries({ queryKey: ["admin-media"] }); onClose(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit Media" : "Add Media"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label>Media Type *</Label>
            <Select value={form.mediaType} onValueChange={(v) => set("mediaType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MEDIA_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>URL *</Label><Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Thumbnail URL</Label><Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
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

export default function AdminMediaCenterPage() {
  const { token, user } = useAuth();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [delConfirm, setDelConfirm] = useState<{ item: MediaItem; permanent: boolean } | null>(null);

  if (user?.role !== "admin") { nav("/dashboard"); return null; }

  const { data: items = [], isLoading, refetch } = useQuery<MediaItem[]>({
    queryKey: ["admin-media"],
    queryFn: () => apiFetch("/media", token!),
    enabled: !!token,
  });

  const action = (path: string, method = "POST") => useMutation({
    mutationFn: () => apiFetch(path, token!, { method }),
    onSuccess: () => { toast({ title: "Done" }); qc.invalidateQueries({ queryKey: ["admin-media"] }); setDelConfirm(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publish = (id: number) => apiFetch(`/media/${id}/publish`, token!, { method: "POST" }).then(() => { toast({ title: "Published" }); qc.invalidateQueries({ queryKey: ["admin-media"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const unpublish = (id: number) => apiFetch(`/media/${id}/unpublish`, token!, { method: "POST" }).then(() => { toast({ title: "Unpublished" }); qc.invalidateQueries({ queryKey: ["admin-media"] }); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  const doDelete = (item: MediaItem, permanent: boolean) => apiFetch(`/media/${item.id}?permanent=${permanent}`, token!, { method: "DELETE" }).then(() => { toast({ title: permanent ? "Permanently deleted" : "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-media"] }); setDelConfirm(null); }).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image className="h-6 w-6 text-blue-400" />
            <div><h1 className="text-xl font-bold text-foreground">Media Center</h1><p className="text-xs text-muted-foreground">Manage images, videos and video links</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" /> Add Media</Button>
          </div>
        </div>

        {isLoading ? <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div> :
          items.length === 0 ? <div className="text-center text-muted-foreground py-12 text-sm">No media yet. Add your first item.</div> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="border-border">
                <div className="relative">
                  {item.thumbnailUrl || item.mediaType === "image_url" ? (
                    <img src={item.thumbnailUrl ?? item.url} alt={item.title} className="w-full h-36 object-cover rounded-t-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-36 bg-muted rounded-t-lg flex items-center justify-center">
                      <Video className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 right-2 text-xs ${STATUS_BADGE[item.status] ?? ""}`}>{item.status}</Badge>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="font-medium text-foreground text-sm line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{MEDIA_TYPES.find((t) => t.value === item.mediaType)?.label ?? item.mediaType}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => { setEditing(item); setFormOpen(true); }}><Edit className="h-3 w-3" /> Edit</Button>
                    {item.status !== "published" ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-green-400 border-green-600/30 hover:bg-green-600/10" onClick={() => void publish(item.id)}><Eye className="h-3 w-3" /> Publish</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-orange-400 border-orange-600/30 hover:bg-orange-600/10" onClick={() => void unpublish(item.id)}><EyeOff className="h-3 w-3" /> Unpublish</Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-red-400 border-red-600/30 hover:bg-red-600/10" onClick={() => setDelConfirm({ item, permanent: false })}><Trash2 className="h-3 w-3" /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </div>

      <FormDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} token={token!} />

      <Dialog open={!!delConfirm} onOpenChange={() => setDelConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" /> Delete Media</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete "{delConfirm?.item.title}"?</p>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="perm-media" onChange={(e) => setDelConfirm((d) => d ? { ...d, permanent: e.target.checked } : null)} />
            <label htmlFor="perm-media" className="text-sm text-muted-foreground">Permanently delete (cannot be recovered)</label>
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
