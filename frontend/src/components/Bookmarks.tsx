import { useState, useEffect, useCallback } from "react";
import { Trash2, ExternalLink, Loader2 } from "lucide-react";
import type { Bookmark } from "@/lib/api";
import { getBookmarks, removeBookmark } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";

type FilterType = "" | "web" | "image";

interface BookmarksProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowGallery: () => void;
  onShowStats: () => void;
}

export function Bookmarks({ onGoHome, onShowSettings, onShowGallery, onShowStats }: BookmarksProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("");
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  const load = useCallback(async (p: number, f: FilterType) => {
    setLoading(true);
    try {
      const data = await getBookmarks(p, perPage, f);
      setBookmarks(p === 1 ? data.bookmarks : (prev) => [...prev, ...data.bookmarks]);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setBookmarks([]);
    setPage(1);
    load(1, filter);
  }, [filter, load]);

  const handleRemove = async (b: Bookmark) => {
    await removeBookmark(b.id);
    setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
    setTotal((prev) => prev - 1);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next, filter);
  };

  const tabs: { label: string; value: FilterType }[] = [
    { label: "All", value: "" },
    { label: "Web", value: "web" },
    { label: "Images", value: "image" },
  ];

  const hasMore = bookmarks.length < total;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onGoHome={onGoHome}
        onShowSettings={onShowSettings}
        onShowBookmarks={() => {}}
        onShowGallery={onShowGallery}
        onShowStats={onShowStats}
      >
        <h1 className="text-base font-semibold">
          Bookmarks
          <span className="ml-2 text-sm font-normal text-muted-foreground">({total})</span>
        </h1>
      </AppHeader>

      <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Filter tabs */}
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Bookmark type filter">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              filter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!loading && bookmarks.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-lg">No bookmarks yet</p>
          <p className="mt-1 text-sm">Click the bookmark icon on search results to save them here.</p>
        </div>
      )}

      {/* Web bookmarks */}
      {bookmarks.filter((b) => b.type === "web").length > 0 && filter !== "image" && (
        <section className="mb-8">
          {filter === "" && <h2 className="mb-4 text-lg font-semibold">Web Results</h2>}
          <div className="space-y-4">
            {bookmarks
              .filter((b) => b.type === "web")
              .map((b) => (
                <article key={b.id} className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=16`}
                        alt=""
                        className="h-4 w-4 rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="truncate">{new URL(b.url).hostname}</span>
                      {b.engine && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{b.engine}</span>}
                    </div>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {b.title}
                      <ExternalLink className="mb-0.5 ml-1 inline h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                    </a>
                    {b.content && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{b.content}</p>
                    )}
                    <time className="mt-1 block text-xs text-muted-foreground/60">
                      {new Date(b.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  <button
                    onClick={() => handleRemove(b)}
                    aria-label={`Remove bookmark: ${b.title}`}
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
          </div>
        </section>
      )}

      {/* Image bookmarks */}
      {bookmarks.filter((b) => b.type === "image").length > 0 && filter !== "web" && (
        <section>
          {filter === "" && <h2 className="mb-4 text-lg font-semibold">Image Results</h2>}
          <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5">
            {bookmarks
              .filter((b) => b.type === "image")
              .map((b) => (
                <div key={b.id} className="group relative mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg">
                  <a href={b.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={b.thumbnail_src || b.img_src}
                      alt={b.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full rounded-lg object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-xs text-white">{b.title}</p>
                      <div className="flex items-center gap-1">
                        <p className="truncate text-[10px] text-white/60">{b.source || new URL(b.url).hostname}</p>
                        {b.width > 0 && b.height > 0 && (
                          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-white/60">
                            {b.width} × {b.height}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemove(b)}
                    aria-label={`Remove bookmark: ${b.title}`}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more
          </button>
        </div>
      )}

      {loading && bookmarks.length === 0 && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      </div>
    </div>
  );
}
