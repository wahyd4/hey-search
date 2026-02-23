import { useState, useEffect, useCallback, type MouseEvent } from "react";
import type { ImageResult } from "@/lib/api";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageResultsProps {
  results: ImageResult[];
}

export function ImageResults({ results }: ImageResultsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selected = selectedIndex !== null ? results[selectedIndex] : null;

  const goPrev = useCallback(() => {
    setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((i) => (i !== null && i < results.length - 1 ? i + 1 : i));
  }, [results.length]);

  const close = useCallback(() => setSelectedIndex(null), []);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "Escape") { close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, goPrev, goNext, close]);

  // Open lightbox on click, but allow Cmd/Ctrl-click to open link natively
  const handleCardClick = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let browser handle
    e.preventDefault();
    setSelectedIndex(i);
  };

  if (results.length === 0) return null;

  return (
    <>
      {/* Masonry grid using CSS columns */}
      <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5" role="list">
        {results.map((img, i) => (
          <a
            key={`${img.img_src}-${i}`}
            href={img.url}
            target="_blank"
            rel="noopener noreferrer"
            role="listitem"
            onClick={(e) => handleCardClick(e, i)}
            className="group relative mb-3 inline-block w-full overflow-hidden rounded-lg border bg-muted break-inside-avoid hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-shadow"
          >
            <img
              src={img.thumbnail_src || img.img_src}
              alt={img.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full object-cover transition-transform group-hover:scale-[1.03]"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23eee' width='200' height='150'/%3E%3Ctext x='100' y='80' text-anchor='middle' fill='%23999' font-size='12'%3ENo image%3C/text%3E%3C/svg%3E";
              }}
            />
            {/* Hover overlay with title */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="truncate text-xs text-white">{img.title}</p>
              <p className="truncate text-[10px] text-white/60">{img.source}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Lightbox */}
      {selected && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label={`Image viewer: ${selected.title}`}
          aria-modal="true"
          onClick={close}
        >
          {/* Prev button */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={selectedIndex <= 0}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-lg hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Next button */}
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={selectedIndex >= results.length - 1}
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-lg hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div
            className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-lg bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              aria-label="Close lightbox"
              className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={selected.img_src}
              alt={selected.title}
              referrerPolicy="no-referrer"
              className="max-h-[70vh] w-auto rounded object-contain"
            />
            <div className="mt-3">
              <h3 className="font-medium">{selected.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Source: {selected.source} • Engine: {selected.engine}
                <span className="ml-2 tabular-nums opacity-60">
                  {selectedIndex + 1} / {results.length}
                </span>
              </p>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-blue-400"
              >
                Visit page →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
