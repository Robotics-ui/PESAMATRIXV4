import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper, Search, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const CATEGORIES = ["All", "forex", "crypto", "indices", "commodities", "market_updates", "economic_events"];
const CATEGORY_LABELS: Record<string, string> = {
  forex: "Forex", crypto: "Crypto", indices: "Indices",
  commodities: "Commodities", market_updates: "Market Updates", economic_events: "Economic Events",
};

interface NewsArticle {
  id: number; headline: string; featuredImageUrl: string | null; summary: string | null;
  content: string; category: string; author: string; status: string;
  publishedAt: string | null; createdAt: string;
}

export default function NewsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  const { data: articles = [], isLoading, refetch } = useQuery<NewsArticle[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const res = await fetch("/api/news", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load news");
      return res.json() as Promise<NewsArticle[]>;
    },
    enabled: !!token,
  });

  const filtered = articles.filter((a) => {
    const matchCat = category === "All" || a.category === category;
    const matchSearch = !search || a.headline.toLowerCase().includes(search.toLowerCase()) || (a.summary ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered[0];

  if (selected) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
            Back to News
          </Button>
          {selected.featuredImageUrl && (
            <img src={selected.featuredImageUrl} alt={selected.headline} className="w-full h-56 object-cover rounded-lg mb-4" />
          )}
          <Badge className="mb-2 bg-blue-600/20 text-blue-400 border-blue-600/30">
            {CATEGORY_LABELS[selected.category] ?? selected.category}
          </Badge>
          <h1 className="text-2xl font-bold text-foreground mb-1">{selected.headline}</h1>
          <p className="text-xs text-muted-foreground mb-4">
            By {selected.author} &middot; {selected.publishedAt ? new Date(selected.publishedAt).toLocaleDateString() : ""}
          </p>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{selected.content}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-bold text-foreground">Trading News</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refetch()} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search news..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"}
                className={category === c ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-muted-foreground"}
                onClick={() => setCategory(c)}>
                {c === "All" ? "All" : (CATEGORY_LABELS[c] ?? c)}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No news articles found.</div>
        ) : (
          <div className="space-y-6">
            {featured && (
              <Card className="border-border cursor-pointer hover:border-blue-600/50 transition-colors" onClick={() => setSelected(featured)}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {featured.featuredImageUrl ? (
                      <img src={featured.featuredImageUrl} alt={featured.headline} className="md:w-64 h-40 md:h-auto object-cover rounded-t-lg md:rounded-l-lg md:rounded-tr-none" />
                    ) : (
                      <div className="md:w-64 h-40 bg-blue-600/10 rounded-t-lg md:rounded-l-lg md:rounded-tr-none flex items-center justify-center">
                        <Newspaper className="h-10 w-10 text-blue-600/30" />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">{CATEGORY_LABELS[featured.category] ?? featured.category}</Badge>
                        <span className="text-xs text-muted-foreground">Featured</span>
                      </div>
                      <h2 className="text-lg font-bold text-foreground mb-1 leading-snug">{featured.headline}</h2>
                      {featured.summary && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{featured.summary}</p>}
                      <p className="text-xs text-muted-foreground">By {featured.author} &middot; {featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString() : ""}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(1).map((a) => (
                <Card key={a.id} className="border-border cursor-pointer hover:border-blue-600/50 transition-colors" onClick={() => setSelected(a)}>
                  {a.featuredImageUrl ? (
                    <img src={a.featuredImageUrl} alt={a.headline} className="w-full h-32 object-cover rounded-t-lg" />
                  ) : (
                    <div className="w-full h-32 bg-blue-600/10 rounded-t-lg flex items-center justify-center">
                      <Newspaper className="h-8 w-8 text-blue-600/30" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <Badge className="mb-2 bg-blue-600/20 text-blue-400 border-blue-600/30 text-xs">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
                    <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 line-clamp-2">{a.headline}</h3>
                    {a.summary && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{a.summary}</p>}
                    <p className="text-xs text-muted-foreground">By {a.author} &middot; {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ""}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
