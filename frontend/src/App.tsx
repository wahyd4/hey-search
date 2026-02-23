import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Globe, ImageIcon, Loader2, ExternalLink, ChevronLeft, ChevronRight, SlidersHorizontal, RefreshCw } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WebResults } from "@/components/WebResults";
import { ImageResults } from "@/components/ImageResults";
import { SearchStats } from "@/components/SearchStats";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorToast } from "@/components/ErrorToast";
import { BackgroundGallery } from "@/components/BackgroundGallery";
import { Bookmarks } from "@/components/Bookmarks";
import { AppHeader } from "@/components/AppHeader";
import { StatsPage } from "@/components/StatsPage";
import { search as apiSearch, isImageResult, getBackground, refreshBackground, getBookmarkedUrls, addBookmark, removeBookmarkByUrl, type SearchResponse, type WebResult, type ImageResult, type BackgroundInfo } from "@/lib/api";
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
  const [showGallery, setShowGallery] = useState(window.location.pathname === "/backgrounds");
  const [showBookmarks, setShowBookmarks] = useState(window.location.pathname === "/bookmarks");
  const [showStats, setShowStats] = useState(window.location.pathname === "/stats");
  const statusRef = useRef<HTMLDivElement>(null);

  // Background image state
  const [bgInfo, setBgInfo] = useState<BackgroundInfo | null>(null);
  const [bgRefreshing, setBgRefreshing] = useState(false);

  // Bookmarked URLs for toggle state
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set());

  // Fetch background and bookmarked URLs on mount
  useEffect(() => {
    getBackground().then(setBgInfo).catch(() => {});
    getBookmarkedUrls().then(setBookmarkedUrls).catch(() => {});
  }, []);

  const bgUrl = bgInfo?.enabled && bgInfo?.url ? bgInfo.url : null;
  const isHome = !hasSearched && !showGallery && !showBookmarks && !showStats;

  // iOS Safari fills top/bottom browser areas from page background color,
  // so sample image edge colors to avoid white/black bars.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    const clearColors = () => {
      root.style.backgroundColor = "";
      body.style.backgroundColor = "";
      if (themeMeta) themeMeta.setAttribute("content", "#000000");
    };

    if (!isHome || !bgUrl) {
      clearColors();
      return;
    }

    const setColors = (topColor: string, bottomColor: string) => {
      root.style.backgroundColor = topColor;
      body.style.backgroundColor = bottomColor;
      if (themeMeta) themeMeta.setAttribute("content", topColor);
    };

    setColors("#111111", "#111111");

    const img = new Image();
    img.src = bgUrl;
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (width < 1 || height < 1) {
          setColors("#111111", "#111111");
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setColors("#111111", "#111111");
          return;
        }

        ctx.drawImage(img, 0, 0);

        const sampleRowColor = (y: number) => {
          const pixels = ctx.getImageData(0, y, width, 1).data;
          let r = 0;
          let g = 0;
          let b = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
          }
          const darken = 0.6; // match bg-black/40 overlay
          return `rgb(${Math.round((r / width) * darken)}, ${Math.round((g / width) * darken)}, ${Math.round((b / width) * darken)})`;
        };

        setColors(sampleRowColor(0), sampleRowColor(height - 1));
      } catch {
        setColors("#111111", "#111111");
      }
    };
    img.onerror = () => setColors("#111111", "#111111");

    return () => {
      clearColors();
    };
  }, [isHome, bgUrl]);



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
          cached: false,
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
      if (window.location.pathname === "/backgrounds") {
        setShowGallery(true); setShowBookmarks(false); setShowStats(false);
        return;
      }
      if (window.location.pathname === "/bookmarks") {
        setShowBookmarks(true); setShowGallery(false); setShowStats(false);
        return;
      }
      if (window.location.pathname === "/stats") {
        setShowStats(true); setShowGallery(false); setShowBookmarks(false);
        return;
      }
      setShowGallery(false);
      setShowBookmarks(false);
      setShowStats(false);
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
    setShowGallery(false);
    setShowBookmarks(false);
    setShowStats(false);
    window.history.pushState(null, "", "/");
    getBackground().then(setBgInfo).catch(() => {});
  };

  const handleRefreshBg = async () => {
    setBgRefreshing(true);
    try {
      const info = await refreshBackground();
      setBgInfo(info);
    } catch {
      // ignore
    } finally {
      setBgRefreshing(false);
    }
  };

  const handleShowGallery = () => {
    setShowGallery(true);
    setShowBookmarks(false);
    setShowStats(false);
    window.history.pushState(null, "", "/backgrounds");
  };

  const handleShowBookmarks = () => {
    setShowBookmarks(true);
    setShowGallery(false);
    setShowStats(false);
    window.history.pushState(null, "", "/bookmarks");
  };

  const handleShowStats = () => {
    setShowStats(true);
    setShowGallery(false);
    setShowBookmarks(false);
    window.history.pushState(null, "", "/stats");
  };

  const handleToggleBookmark = async (result: WebResult | ImageResult) => {
    const isImage = "img_src" in result;
    const url = result.url;
    if (bookmarkedUrls.has(url)) {
      await removeBookmarkByUrl(url);
      setBookmarkedUrls((prev) => { const next = new Set(prev); next.delete(url); return next; });
    } else {
      await addBookmark({
        type: isImage ? "image" : "web",
        title: result.title,
        url: result.url,
        content: "content" in result ? result.content : "",
        engine: result.engine,
        ...(isImage && {
          img_src: (result as ImageResult).img_src,
          thumbnail_src: (result as ImageResult).thumbnail_src,
          source: (result as ImageResult).source,
          width: (result as ImageResult).width,
          height: (result as ImageResult).height,
        }),
      });
      setBookmarkedUrls((prev) => new Set(prev).add(url));
    }
  };

  const webResults = response?.results.filter((r): r is WebResult => !isImageResult(r)) ?? [];
  const imageResults = response?.results.filter((r): r is ImageResult => isImageResult(r)) ?? [];
  const hasResults = (response?.results.length ?? 0) > 0;

  // SettingsModal is always rendered here so it works on every page
  const settingsModal = (
    <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
  );

  // Gallery page
  if (showGallery) {
    return <>
      <BackgroundGallery onBack={handleGoHome} onShowSettings={() => setShowSettings(true)} onShowBookmarks={handleShowBookmarks} onShowStats={handleShowStats} />
      {settingsModal}
    </>;
  }

  // Bookmarks page
  if (showBookmarks) {
    return <>
      <Bookmarks onGoHome={handleGoHome} onShowSettings={() => setShowSettings(true)} onShowGallery={handleShowGallery} onShowStats={handleShowStats} />
      {settingsModal}
    </>;
  }

  // Stats page
  if (showStats) {
    return <>
      <StatsPage onGoHome={handleGoHome} />
      {settingsModal}
    </>;
  }

  // Home page (no search yet)
  if (!hasSearched) {
    return (
      <div className="relative min-h-screen" style={{ minHeight: "100svh" }}>
        {/* Background image */}
        {bgUrl && (
          <div
            className="fixed left-0 right-0 bg-cover bg-center transition-opacity duration-700"
            style={{
              backgroundImage: `url(${bgUrl})`,
              top: "calc(env(safe-area-inset-top, 0px) * -1)",
              bottom: "calc(env(safe-area-inset-bottom, 0px) * -1)",
            }}
          >
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          </div>
        )}

        <div className="relative z-10 flex min-h-screen flex-col" style={{ minHeight: "100svh" }}>
          {/* Shared header */}
          <AppHeader
            onGoHome={handleGoHome}
            onShowSettings={() => setShowSettings(true)}
            onShowBookmarks={handleShowBookmarks}
            onShowGallery={handleShowGallery}
            onShowStats={handleShowStats}
            transparent={!!bgUrl}
            hideLogo
          />

          {/* Center content */}
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                <span className={cn(
                  "bg-clip-text text-transparent",
                  bgUrl
                    ? "bg-gradient-to-r from-white to-white/90"
                    : "bg-gradient-to-r from-blue-600 to-purple-600"
                )}>
                  Hey Search
                </span>
              </h1>
              <p className={cn("mt-2", bgUrl ? "text-white/70" : "text-muted-foreground")}>
                Private metasearch engine
              </p>
            </div>

            <SearchBar onSearch={(q) => doSearch(q, category)} className="w-full" />

            {/* Category switch */}
            <div className="mt-4 flex items-center gap-2" role="group" aria-label="Search category">
              {([
                { key: "web" as const, label: "Web", icon: Globe },
                { key: "images" as const, label: "Images", icon: ImageIcon },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  aria-pressed={category === key}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    category === key
                      ? bgUrl
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-primary text-primary-foreground"
                      : bgUrl
                        ? "text-white/60 hover:text-white hover:bg-white/10 border border-transparent"
                        : "text-muted-foreground hover:bg-accent border border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom-right: new image button */}
          {bgUrl && (
            <button
              onClick={handleRefreshBg}
              disabled={bgRefreshing}
              aria-label="New background image"
              title="New background image"
              className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-black/30 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors backdrop-blur-sm"
            >
              <RefreshCw className={cn("h-4 w-4", bgRefreshing && "animate-spin")} aria-hidden="true" />
              <span className="hidden sm:inline">{bgRefreshing ? "Loading…" : "New image"}</span>
            </button>
          )}

          {/* Bottom-left: image source */}
          {bgInfo?.source_url && bgUrl && (
            <a
              href={bgInfo.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-6 left-6 flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Image source
            </a>
          )}
        </div>

        {settingsModal}
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

      {/* Shared header with search bar in center slot */}
      <AppHeader
        onGoHome={handleGoHome}
        onShowSettings={() => setShowSettings(true)}
        onShowBookmarks={handleShowBookmarks}
        onShowGallery={handleShowGallery}
        onShowStats={handleShowStats}
      >
        <SearchBar initialQuery={query} onSearch={(q) => doSearch(q)} />
      </AppHeader>

      {/* Category / filter bar */}
      <div className="sticky top-[57px] z-30 border-b bg-background/95 backdrop-blur">
        <nav aria-label="Search categories" className="flex items-center gap-1 px-4 py-2">
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
      </div>

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
                {category === "web" && <WebResults results={webResults} query={query} category={category} bookmarkedUrls={bookmarkedUrls} onToggleBookmark={handleToggleBookmark} />}
                {category === "images" && <ImageResults results={imageResults} query={query} category={category} bookmarkedUrls={bookmarkedUrls} onToggleBookmark={handleToggleBookmark} />}

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
      <footer className="border-t px-4 py-3 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl text-center">Hey Search</div>
      </footer>

      {/* Error toasts */}
      {response?.errors && <ErrorToast errors={response.errors} />}

      {/* Settings modal */}
      {settingsModal}
    </div>
  );
}

export default App;
