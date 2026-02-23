import type { WebResult } from "@/lib/api";
import { trackClick } from "@/lib/api";
import { ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";

interface WebResultsProps {
  results: WebResult[];
  query?: string;
  category?: string;
  bookmarkedUrls?: Set<string>;
  onToggleBookmark?: (result: WebResult) => void;
}

export function WebResults({ results, query = "", category = "web", bookmarkedUrls, onToggleBookmark }: WebResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-6">
      {results.map((result, i) => {
        const isBookmarked = bookmarkedUrls?.has(result.url) ?? false;
        return (
        <article key={`${result.url}-${i}`} className="group max-w-2xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src={`https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=16`}
              alt=""
              className="h-4 w-4 rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="truncate">{new URL(result.url).hostname}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{result.engine}</span>
            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(result)}
                aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
                className="ml-auto rounded p-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                )}
              </button>
            )}
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick({ query, category, position: i + 1, url: result.url, title: result.title, engine: result.engine })}
            className="mt-1 block text-lg font-medium text-blue-600 visited:text-purple-600 hover:underline dark:text-blue-400 dark:visited:text-purple-400 sm:text-xl"
          >
            {result.title}
            <ExternalLink className="mb-1 ml-1 inline h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
          </a>
          {result.content && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {result.content}
            </p>
          )}
        </article>
        );
      })}
    </div>
  );
}
