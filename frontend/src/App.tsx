import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Settings, Globe, ImageIcon, Loader2, ExternalLink, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WebResults } from "@/components/WebResults";
import { ImageResults } from "@/components/ImageResults";
import { SearchStats } from "@/components/SearchStats";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorToast } from "@/components/ErrorToast";
import { search as apiSearch, isImageResult, type SearchResponse, type WebResult, type ImageResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type Category = "web" | "images";
type ImageSize = "" | "large" | "medium" | "small";

const IMAGE_SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: "", label: "All sizes" },
  { value: "large", label: "Large" },
  { value: "medium", label: "Medium" },
  { value: "small", label: "Small" },
];

function parseUrlState(): { q: string; cat: Category; page: number; imageSize: ImageSize; engines: string } {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") ?? "";
  const cat = params.get("category") === "images" ? "images" : "web";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const rawSize = params.get("image_size") ?? "";
  const imageSize: ImageSize = (["large", "medium", "small"].includes(rawSize) ? rawSize : "") as ImageSize;
  const engines = params.get("engines") ?? "";
  return { q, cat, page, imageSize, engines };
}

function pushUrl(q: string, cat: Category, page: number, imageSize: ImageSize = "", engines: string = "") {
  const params = new URLSearchParams();
  params.set("q", q);
  if (cat !== "web") params.set("category", cat);
  if (page > 1) params.set("page", String(page));
  if (imageSize) params.set("image_size", imageSize);
  if (engines) params.set("engines", engines);
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
  const [imageSize, setImageSize] = useState<ImageSize>(initial.imageSize);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initial.q);
  const statusRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(
    async (q: string, cat: Category = category, p: number = 1, size: ImageSize = imageSize, updateUrl = true) => {
      if (!q.trim()) return;
      setQuery(q);
      setCategory(cat);
      setPage(p);
      setImageSize(size);
      setLoading(true);
      setHasSearched(true);
      if (updateUrl) pushUrl(q, cat, p, cat === "images" ? size : "");
      try {
        const res = await apiSearch(q, cat, p, cat === "images" ? size : "");
        setResponse(res);
      } catch (err) {
        setResponse({
          query: q,
          category: cat,
          page: p,
          results: [],
          errors: [{ engine: "system", message: String(err), is_timeout: false, code: "client_error", details: "", retry_hint: "Check your connection" }],
          suggestions: [],
          engine_stats: [],
          timestamp: new Date().toISOString(),
          total_results: 0,
          has_next: false,
        });
      } finally {
        setLoading(false);
      }
    },
    [category, imageSize]
  );

  // Restore search from URL on initial load
  useEffect(() => {
    if (initial.q) {
      doSearch(initial.q, initial.cat, initial.page, initial.imageSize, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const { q, cat, page: p, imageSize: size } = parseUrlState();
      if (q) {
        doSearch(q, cat, p, size, false);
      } else {
        setHasSearched(false);
        setResponse(null);
        setQuery("");
        setPage(1);
        setCategory("web");
        setImageSize("");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [doSearch]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    if (query) doSearch(query, cat, 1, cat === "images" ? imageSize : "");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    doSearch(query, category, newPage, imageSize);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImageSizeChange = (size: ImageSize) => {
    setImageSize(size);
    if (query) doSearch(query, category, 1, size);
  };

  const handleGoHome = () => {
    setHasSearched(false);
    setResponse(null);
    setPage(1);
    setImageSize("");
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
            aria-label="Open settings"
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Settings className="h-4 w-4" aria-hidden="true" /> Settings
          </button>
        </div>

        <footer className="absolute bottom-6 text-center">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            API Docs
          </a>
        </footer>

        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Results page
  const statusMessage = loading
    ? "Searching…"
    : response
      ? `${response.results.length} result${response.results.length !== 1 ? "s" : ""} for "${query}" — page ${page}`
      : "";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>

      {/* Live status region */}
      <div ref={statusRef} aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleGoHome}
            aria-label="Go to homepage"
            className="shrink-0 text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
          >
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              HS
            </span>
          </button>
          <SearchBar initialQuery={query} onSearch={(q) => doSearch(q)} className="flex-1" />
          <button
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Open settings"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Category tabs */}
        <nav aria-label="Search categories" className="flex items-center gap-1 px-4 pb-2">
          {([
            { key: "web" as const, label: "Web", icon: Globe },
            { key: "images" as const, label: "Images", icon: ImageIcon },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              aria-current={category === key ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                category === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}

          {/* Image size filter — only visible in images category */}
          {category === "images" && (
            <>
              <div className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {IMAGE_SIZE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleImageSizeChange(value)}
                  aria-pressed={imageSize === value}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    imageSize === value
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </nav>
      </header>

      {/* Content */}
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading search results…</span>
          </div>
        ) : response && response.results.length === 0 && response.errors.length === 0 ? (
          <div className="py-20 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
            <h2 className="mt-4 text-lg text-muted-foreground">No results found for &ldquo;{query}&rdquo;</h2>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Search results for &ldquo;{query}&rdquo;</h2>

            {/* Mobile stats — shown above results on small screens */}
            {response && (
              <div className="mb-4 lg:hidden">
                <SearchStats
                  stats={response.engine_stats}
                  errors={response.errors}
                  page={page}
                  totalResults={response.results.length}
                  cached={response.cached}
                  initialCollapsed
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
                  <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      aria-label="Previous page"
                      className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Previous
                    </button>
                    <span className="text-sm tabular-nums text-muted-foreground" aria-current="page">
                      Page {page}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      aria-label="Next page"
                      className="flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </div>

              {/* Stats sidebar — hidden on mobile, shown on lg+ */}
              {response && (
                <aside className="hidden w-64 shrink-0 lg:block" aria-label="Search statistics">
                  <div className="sticky top-28">
                    <SearchStats
                      stats={response.engine_stats}
                      errors={response.errors}
                      page={page}
                      totalResults={response.results.length}
                      cached={response.cached}
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
            className="flex items-center gap-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded transition-colors"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
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
