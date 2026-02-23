import { useState, useEffect, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { listBackgrounds, type BackgroundListItem } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";

interface BackgroundGalleryProps {
  onBack: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowStats: () => void;
}

export function BackgroundGallery({ onBack, onShowSettings, onShowBookmarks, onShowStats }: BackgroundGalleryProps) {
  const [images, setImages] = useState<BackgroundListItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const PER_PAGE = 20;

  const loadMore = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const items = await listBackgrounds(p, PER_PAGE);
      if (p === 1) {
        setImages(items);
      } else {
        setImages((prev) => [...prev, ...items]);
      }
      setHasMore(items.length >= PER_PAGE);
    } catch (err) {
      console.error("Failed to load backgrounds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMore(1);
  }, [loadMore]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadMore(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onGoHome={onBack}
        onShowSettings={onShowSettings}
        onShowBookmarks={onShowBookmarks}
        onShowGallery={() => {}}
        onShowStats={onShowStats}
      >
        <h1 className="text-base font-semibold">
          Background Gallery
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({images.length})
          </span>
        </h1>
      </AppHeader>

      {/* Image grid */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {images.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-12">No background images saved yet.</p>
        )}

        <div className="columns-1 gap-4 sm:columns-2 md:columns-3">
          {images.map((img) => (
            <a
              key={img.filename}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative mb-4 inline-block w-full overflow-hidden rounded-lg border bg-muted break-inside-avoid hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-shadow"
            >
              <img
                src={img.url}
                alt={img.filename}
                loading="lazy"
                className="w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-xs text-white/80">
                  {new Date(img.created_at * 1000).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-white/60">
                    {(img.size_bytes / 1024).toFixed(0)} KB
                  </p>
                  {img.source_url && (
                    <a
                      href={img.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto flex items-center gap-1 text-[10px] text-white/70 hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source
                    </a>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="rounded-full border px-6 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </span>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        )}

        {loading && images.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>
    </div>
  );
}

