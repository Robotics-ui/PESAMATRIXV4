import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, RefreshCw, ExternalLink, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const CATEGORIES = ["All", "beginner", "technical_analysis", "fundamental_analysis", "risk_management", "psychology", "mt4_tutorials", "mt5_tutorials", "copy_trading"];
const CATEGORY_LABELS: Record<string, string> = {
  beginner: "Beginner Trading", technical_analysis: "Technical Analysis",
  fundamental_analysis: "Fundamental Analysis", risk_management: "Risk Management",
  psychology: "Psychology", mt4_tutorials: "MT4 Tutorials", mt5_tutorials: "MT5 Tutorials", copy_trading: "Copy Trading",
};

interface Resource {
  id: number; title: string; description: string | null; category: string;
  resourceType: string; url: string; thumbnailUrl: string | null;
  status: string; publishedAt: string | null; createdAt: string;
}

export default function ResourcesPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const { data: resources = [], isLoading, refetch } = useQuery<Resource[]>({
    queryKey: ["resources"],
    queryFn: async () => {
      const res = await fetch("/api/resources", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load resources");
      return res.json() as Promise<Resource[]>;
    },
    enabled: !!token,
  });

  const filtered = resources.filter((r) => {
    const matchCat = category === "All" || r.category === category;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || (r.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-green-400" />
            <h1 className="text-xl font-bold text-foreground">Learning Resources</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refetch()} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"}
                className={category === c ? "bg-green-600 hover:bg-green-700 text-white" : "text-muted-foreground"}
                onClick={() => setCategory(c)}>
                {c === "All" ? "All" : (CATEGORY_LABELS[c] ?? c)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No resources found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border hover:border-green-600/50 transition-colors">
                {r.thumbnailUrl ? (
                  <img src={r.thumbnailUrl} alt={r.title} className="w-full h-36 object-cover rounded-t-lg" />
                ) : (
                  <div className="w-full h-36 bg-green-600/10 rounded-t-lg flex items-center justify-center">
                    {r.resourceType === "video_link" ? (
                      <Play className="h-10 w-10 text-green-600/40" />
                    ) : (
                      <BookOpen className="h-10 w-10 text-green-600/40" />
                    )}
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                    <Badge variant="outline" className="text-xs">{r.resourceType === "video_link" ? "Video" : "Link"}</Badge>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{r.title}</h3>
                  {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white mt-1 gap-2">
                      {r.resourceType === "video_link" ? <><Play className="h-3 w-3" /> Watch</> : <><ExternalLink className="h-3 w-3" /> Open</>}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
