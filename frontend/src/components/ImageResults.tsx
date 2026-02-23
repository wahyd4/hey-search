import { useState } from "react";
import type { ImageResult } from "@/lib/api";
import { X } from "lucide-react";

interface ImageResultsProps {
  results: ImageResult[];
}

export function ImageResults({ results }: ImageResultsProps) {
  const [selected, setSelected] = useState<ImageResult | null>(null);

  if (results.length === 0) return null;

  return (
    <>
      {/* Masonry grid using CSS columns */}
      <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5">
        {results.map((img, i) => (
          <button
            key={`${img.img_src}-${i}`}
            onClick={() => setSelected(img)}
            className="group relative mb-3 inline-block w-full overflow-hidden rounded-lg border bg-muted break-inside-avoid hover:ring-2 hover:ring-ring transition-shadow"
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
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-auto rounded-lg bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 hover:bg-background"
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
              </p>
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
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
