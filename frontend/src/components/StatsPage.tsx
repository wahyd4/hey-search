import { useEffect, useState } from "react";
import { fetchStats, type StatsSummary } from "@/lib/api";
import { BarChart2, TrendingUp, MousePointerClick, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface StatsPageProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowGallery: () => void;
  onShowHistory?: () => void;
}

function Card({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StatsPage({ onGoHome, onShowSettings, onShowBookmarks, onShowGallery, onShowHistory }: StatsPageProps) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchStats(days)
      .then(setData)
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onGoHome={onGoHome}
        onShowSettings={onShowSettings}
        onShowBookmarks={onShowBookmarks}
        onShowGallery={onShowGallery}
        onShowStats={() => {}}
        onShowHistory={onShowHistory}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
            <BarChart2 className="h-4 w-4 shrink-0" />
            Search Analytics
          </h1>
          <div className="flex items-center gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </AppHeader>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {loading && <p className="text-center text-muted-foreground py-16">Loading…</p>}
        {error && <p className="text-center text-destructive py-16">{error}</p>}

        {data && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card title="Searches" value={data.total_searches.toLocaleString()} sub={`last ${days} days`} />
              <Card title="Clicks" value={data.total_clicks.toLocaleString()} sub={`last ${days} days`} />
              <Card
                title="CTR"
                value={data.total_searches > 0 ? `${((data.total_clicks / data.total_searches) * 100).toFixed(1)}%` : "—"}
                sub="clicks / searches"
              />
              <Card
                title="Avg position"
                value={
                  data.top_positions.length > 0
                    ? (
                        data.top_positions.reduce((s, p) => s + p.position * p.count, 0) /
                        data.top_positions.reduce((s, p) => s + p.count, 0)
                      ).toFixed(1)
                    : "—"
                }
                sub="clicked result rank"
              />
            </div>

            {/* Daily trend */}
            {data.daily_searches.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4" /> Daily Searches
                </h2>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-end gap-1 h-28">
                    {[...data.daily_searches].reverse().map((d) => {
                      const max = Math.max(...data.daily_searches.map((x) => x.searches), 1);
                      const pct = (d.searches / max) * 100;
                      return (
                        <div key={d.date} className="flex flex-1 flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.searches}`}>
                          <div
                            className="w-full rounded-sm bg-primary/70 transition-all"
                            style={{ height: `${Math.max(pct, 2)}%` }}
                          />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center hidden sm:block">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Top queries */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <Search className="h-4 w-4" /> Top Queries
                </h2>
                <div className="rounded-xl border bg-card divide-y">
                  {data.top_queries.length === 0 && (
                    <p className="px-4 py-6 text-sm text-center text-muted-foreground">No data yet</p>
                  )}
                  {data.top_queries.map((q, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 truncate font-medium">{q.query}</span>
                      <span className="tabular-nums text-muted-foreground">{q.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Engine clicks */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <MousePointerClick className="h-4 w-4" /> Clicks by Engine
                </h2>
                <div className="rounded-xl border bg-card divide-y">
                  {data.engine_clicks.length === 0 && (
                    <p className="px-4 py-6 text-sm text-center text-muted-foreground">No data yet</p>
                  )}
                  {data.engine_clicks.map((e, i) => {
                    const total = data.engine_clicks.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="flex-1 capitalize font-medium">{e.engine || "unknown"}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums text-muted-foreground w-8 text-right">{e.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Position distribution */}
            {data.top_positions.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <MousePointerClick className="h-4 w-4" /> Click Position Distribution
                </h2>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-end gap-2 h-24">
                    {data.top_positions.map((p) => {
                      const max = Math.max(...data.top_positions.map((x) => x.count), 1);
                      const pct = (p.count / max) * 100;
                      return (
                        <div key={p.position} className="flex flex-1 flex-col items-center gap-1" title={`#${p.position}: ${p.count} clicks`}>
                          <div
                            className="w-full rounded-sm bg-blue-500/70 transition-all"
                            style={{ height: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="text-[10px] text-muted-foreground">#{p.position}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Top clicked URLs */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <MousePointerClick className="h-4 w-4" /> Top Clicked Results
              </h2>
              <div className="rounded-xl border bg-card divide-y">
                {data.top_clicked_urls.length === 0 && (
                  <p className="px-4 py-6 text-sm text-center text-muted-foreground">No clicks recorded yet</p>
                )}
                {data.top_clicked_urls.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.title || r.url}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.url}</p>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">{r.engine}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
