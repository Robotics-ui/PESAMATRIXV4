import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  RefreshCw,
  X,
} from "lucide-react";

const FAQ_CATEGORIES = [
  "All",
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

function FaqItem({ faq, isOpen, onToggle }: { faq: Faq; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-lg border transition-colors ${isOpen ? "border-blue-600/40 bg-blue-600/5" : "border-border hover:border-blue-600/20"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-medium leading-snug ${isOpen ? "text-blue-300" : "text-foreground"}`}>
          {faq.question}
        </span>
        <div className="shrink-0">
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-blue-400" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="border-t border-blue-600/20 pt-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                {faq.category}
              </Badge>
              {faq.viewCount > 10 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {faq.viewCount} views
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openId, setOpenId] = useState<number | null>(null);
  const searchLogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ["faqs"],
    queryFn: async () => {
      const res = await fetch("/api/faqs");
      if (!res.ok) throw new Error("Failed to load FAQs");
      return res.json() as Promise<Faq[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const logSearch = useCallback((term: string, count: number) => {
    if (!token || !term.trim()) return;
    void fetch("/api/faqs/search-log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ searchTerm: term, resultCount: count }),
    });
  }, [token]);

  const filtered = faqs.filter((f) => {
    const matchesCategory = activeCategory === "All" || f.category === activeCategory;
    const matchesSearch = !search.trim()
      || f.question.toLowerCase().includes(search.toLowerCase())
      || f.answer.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const popular = [...faqs]
    .filter((f) => f.viewCount > 0)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5);

  const showPopular = !search.trim() && activeCategory === "All" && popular.length > 0;

  useEffect(() => {
    if (!search.trim()) return;
    if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
    searchLogTimer.current = setTimeout(() => {
      logSearch(search, filtered.length);
    }, 800);
    return () => { if (searchLogTimer.current) clearTimeout(searchLogTimer.current); };
  }, [search, filtered.length, logSearch]);

  const toggle = (id: number) => setOpenId((prev) => (prev === id ? null : id));

  const clearSearch = () => {
    setSearch("");
    setOpenId(null);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
            <HelpCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Frequently Asked Questions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Find answers to common questions about PesaMatrix</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenId(null); setActiveCategory("All"); }}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        {!search && (
          <div className="flex gap-2 flex-wrap">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenId(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-border text-muted-foreground hover:border-blue-600/40 hover:text-blue-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Popular questions section */}
            {showPopular && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <h2 className="text-sm font-semibold text-foreground">Most Viewed</h2>
                </div>
                <div className="space-y-2">
                  {popular.map((faq) => (
                    <FaqItem
                      key={`popular-${faq.id}`}
                      faq={faq}
                      isOpen={openId === faq.id}
                      onToggle={() => toggle(faq.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Filtered / All results */}
            {search && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filtered.length === 0
                    ? `No results for "${search}"`
                    : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`
                  }
                </p>
                <Button variant="ghost" size="sm" onClick={clearSearch} className="text-xs text-muted-foreground">
                  Clear
                </Button>
              </div>
            )}

            {!showPopular || search || activeCategory !== "All" ? (
              filtered.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <HelpCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm font-medium text-foreground">No matching questions</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try a different search term or browse all categories
                    </p>
                    <Button variant="outline" size="sm" onClick={clearSearch} className="mt-4">
                      Browse all FAQs
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {!search && activeCategory !== "All" && (
                    <h2 className="text-sm font-semibold text-foreground">{activeCategory}</h2>
                  )}
                  {filtered.map((faq) => (
                    <FaqItem
                      key={faq.id}
                      faq={faq}
                      isOpen={openId === faq.id}
                      onToggle={() => toggle(faq.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              /* All FAQs grouped by category when no filters */
              <div className="space-y-6">
                {FAQ_CATEGORIES.filter((c) => c !== "All").map((cat) => {
                  const catFaqs = faqs.filter((f) => f.category === cat);
                  if (catFaqs.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-sm font-semibold text-foreground">{cat}</h2>
                        <span className="text-xs text-muted-foreground">({catFaqs.length})</span>
                      </div>
                      {catFaqs.map((faq) => (
                        <FaqItem
                          key={faq.id}
                          faq={faq}
                          isOpen={openId === faq.id}
                          onToggle={() => toggle(faq.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
