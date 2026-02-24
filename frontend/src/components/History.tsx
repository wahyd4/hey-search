import { useState, useEffect, useCallback } from "react";
import { Clock, Trash2, Globe, ImageIcon, Loader2, X } from "lucide-react";
import { getHistory, deleteHistoryEntry, clearHistory, type HistoryEntry } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";

interface HistoryProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowGallery: () => void;
  onShowStats: () => void;
  onSearch: (query: string, category: string) => void;
}

/** Returns a human-friendly day label for a UTC ISO timestamp, in local time. */
function dayLabel(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

/** Groups entries by day label preserving order. */
function groupByDay(entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const label = dayLabel(entry.ts);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(entry);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export function History({
  onGoHome,
  onShowSettings,
  onShowBookmarks,
  onShowGallery,
  onShowStats,
  onSearch,
}: HistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const perPage = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getHistory(p, perPage);
      setEntries((prev) => (p === 1 ? data.entries : [...prev, ...data.entries]));
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleDelete = async (entry: HistoryEntry) => {
    await deleteHistoryEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    setTotal((prev) => prev - 1);
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all search history?")) return;
    setClearing(true);
    try {
      await clearHistory();
      setEntries([]);
      setTotal(0);
    } finally {
      setClearing(false);
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next);
  };

  const groups = groupByDay(entries);
  const hasMore = entries.length < total;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onGoHome={onGoHome}
        onShowSettings={onShowSettings}
        onShowBookmarks={onShowBookmarks}
        onShowGallery={onShowGallery}
        onShowStats={onShowStats}
      >
        <h1 className="text-base font-semibold">
          History
          {total > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({total})</span>
          )}
        </h1>
      </AppHeader>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Toolbar */}
        {total > 0 && (
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total} searches recorded</p>
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear all
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && entries.length === 0 && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <Clock className="h-10 w-10 opacity-30" />
            <p className="text-sm">No search history yet.<br />Your searches will appear here.</p>
          </div>
        )}

        {/* Grouped list */}
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              {/* Day label */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Entries */}
              <ul className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
                {group.items.map((entry) => (
                  <li key={entry.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                    {/* Category icon */}
                    <span className="shrink-0 text-muted-foreground">
                      {entry.category === "images"
                        ? <ImageIcon className="h-4 w-4" aria-label="Images" />
                        : <Globe className="h-4 w-4" aria-label="Web" />}
                    </span>

                    {/* Clickable query */}
                    <button
                      className="flex-1 text-left text-sm font-medium truncate cursor-pointer hover:text-primary focus-visible:outline-none focus-visible:underline"
                      onClick={() => onSearch(entry.query, entry.category)}
                      title={entry.query}
                    >
                      {entry.query}
                    </button>

                    {/* Time */}
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums hidden sm:block">
                      {new Date(entry.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(entry)}
                      aria-label={`Remove "${entry.query}" from history`}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="rounded-full px-5 py-2 text-sm font-medium border hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
