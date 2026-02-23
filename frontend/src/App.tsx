import { useState, useCallback } from "react";
import { Search, Settings, Globe, ImageIcon, Loader2, ExternalLink } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WebResults } from "@/components/WebResults";
import { ImageResults } from "@/components/ImageResults";
import { SettingsModal } from "@/components/SettingsModal";
import { ErrorToast } from "@/components/ErrorToast";
import { search as apiSearch, isImageResult, type SearchResponse, type WebResult, type ImageResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type Category = "web" | "images";

function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("web");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(
    async (q: string, cat: Category = category) => {
      if (!q.trim()) return;
      setQuery(q);
      setLoading(true);
      setHasSearched(true);
      try {
        const res = await apiSearch(q, cat);
        setResponse(res);
      } catch (err) {
        setResponse({
          query: q,
          category: cat,
          results: [],
          errors: [{ engine: "system", message: String(err), is_timeout: false }],
          suggestions: [],
        });
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    if (query) doSearch(query, cat);
  };

  const webResults = response?.results.filter((r): r is WebResult => !isImageResult(r)) ?? [];
  const imageResults = response?.results.filter((r): r is ImageResult => isImageResult(r)) ?? [];

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
            onClick={() => { setHasSearched(false); setResponse(null); }}
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : response && response.results.length === 0 && response.errors.length === 0 ? (
          <div className="py-20 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg text-muted-foreground">No results found for "{query}"</p>
          </div>
        ) : (
          <>
            {category === "web" && <WebResults results={webResults} />}
            {category === "images" && <ImageResults results={imageResults} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-muted-foreground">
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
