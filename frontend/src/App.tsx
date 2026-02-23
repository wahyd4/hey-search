import { useState, useCallback, useEffect } from "react";
import { Search, Settings, Globe, ImageIcon, Loader2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WebResults } from "@/components/WebResults";
import { ImageResults } from "@/components/ImageResults";
import { SearchStats } from "@/components/SearchStats";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorToast } from "@/components/ErrorToast";
import { search as apiSearch, isImageResult, type SearchResponse, type WebResult, type ImageResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type Category = "web" | "images";

function parseUrlState(): { q: string; cat: Category; page: number } {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") ?? "";
  const cat = params.get("category") === "images" ? "images" : "web";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  return { q, cat, page };
}

function pushUrl(q: string, cat: Category, page: number) {
  const params = new URLSearchParams();
  params.set("q", q);
  if (cat !== "web") params.set("category", cat);
  if (page > 1) params.set("page", String(page));
  const url = `/?${params.toString()}`;
  if (window.location.pathname + window.location.search !== url) {
    window.history.pushState(null, "", url);
  }
}

function App() {
  const initial = parseUrlState();
  const [query, setQuery] = useState(initial.q);
  const [category, setCategory] = useState<Category>(initial.cat);
  const [page, setPage] = useState(initial.page);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initial.q);

  const doSearch = useCallback(
    async (q: string, cat: Category = category, p: number = 1, updateUrl = true) => {
      if (!q.trim()) return;
      setQuery(q);
      setCategory(cat);
      setPage(p);
      setLoading(true);
      setHasSearched(true);
      if (updateUrl) pushUrl(q, cat, p);
      try {
        const res = await apiSearch(q, cat, p);
        setResponse(res);
      } catch (err) {
        setResponse({
          query: q,
          category: cat,
          page: p,
          results: [],
          errors: [{ engine: "system", message: String(err), is_timeout: false }],
          suggestions: [],
          engine_stats: [],
        });
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  // Restore search from URL on initial load
  useEffect(() => {
    if (initial.q) {
      doSearch(initial.q, initial.cat, initial.page, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const { q, cat, page: p } = parseUrlState();
      if (q) {
        doSearch(q, cat, p, false);
      } else {
        setHasSearched(false);
        setResponse(null);
        setQuery("");
        setPage(1);
        setCategory("web");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [doSearch]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    if (query) doSearch(query, cat, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    doSearch(query, category, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoHome = () => {
    setHasSearched(false);
    setResponse(null);
    setPage(1);
    window.history.pushState(null, "", "/");
  };

  const webResults = response?.results.filter((r): r is WebResult => !isImageResult(r)) ?? [];
  const imageResults = response?.results.filter((r): r is ImageResult => isImageResult(r)) ?? [];
  const hasResults = (response?.results.length ?? 0) > 0;

  // Home page (no search yet)
  if (!hasSearched) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hey Search
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground">Private metasearch engine</p>
        </div>

        <SearchBar onSearch={(q) => doSearch(q)} className="w-full" />

        <div className="mt-6">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>

        <footer className="absolute bottom-6 text-center">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            API Docs
          </a>
        </footer>

        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Results page
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleGoHome}
            className="shrink-0 text-xl font-bold"
          >
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              HS
            </span>
          </button>
          <SearchBar initialQuery={query} onSearch={(q) => doSearch(q)} className="flex-1" />
          <button
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-4 pb-2">
          {([
            { key: "web" as const, label: "Web", icon: Globe },
            { key: "images" as const, label: "Images", icon: ImageIcon },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                category === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : response && response.results.length === 0 && response.errors.length === 0 ? (
          <div className="py-20 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg text-muted-foreground">No results found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <>
            {/* Mobile stats — shown above results on small screens */}
            {response && (
              <div className="mb-4 lg:hidden">
                <SearchStats
                  stats={response.engine_stats}
                  errors={response.errors}
                  page={page}
                  totalResults={response.results.length}
                />
              </div>
            )}

            <div className="flex gap-6">
              {/* Results column */}
              <div className="min-w-0 flex-1">
                {category === "web" && <WebResults results={webResults} />}
                {category === "images" && <ImageResults results={imageResults} />}

                {/* Pagination */}
                {hasResults && (
                  <div className="mt-8 flex items-center justify-center gap-3">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Page {page}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Stats sidebar — hidden on mobile, shown on lg+ */}
              {response && (
                <aside className="hidden w-64 shrink-0 lg:block">
                  <div className="sticky top-28">
                    <SearchStats
                      stats={response.engine_stats}
                      errors={response.errors}
                      page={page}
                      totalResults={response.results.length}
                    />
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-muted-foreground">
          <span>Hey Search</span>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            API Docs
          </a>
        </div>
      </footer>

      {/* Error toasts */}
      {response?.errors && <ErrorToast errors={response.errors} />}

      {/* Settings modal */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;
