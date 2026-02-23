import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { EngineStat, EngineError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SearchStatsProps {
  stats: EngineStat[];
  errors: EngineError[];
  page: number;
  totalResults: number;
  initialCollapsed?: boolean;
}

export function SearchStats({ stats, page, totalResults, initialCollapsed = false }: SearchStatsProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  if (stats.length === 0) return null;

  const totalFromEngines = stats.reduce((sum, s) => sum + s.result_count, 0);

  return (
    <div className="rounded-xl border bg-card text-card-foreground">
      {/* Header — always visible, acts as toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4" />
          Search Stats
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalResults} result{totalResults !== 1 && "s"} · page {page}
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t px-4 pb-4 pt-3">
          {/* Per-engine rows */}
          <ul className="space-y-2">
            {stats.map((stat) => (
              <li key={stat.engine} className="group relative flex items-center gap-2">
                <StatusIcon status={stat.status} />
                <span
                  className={cn(
                    "flex-1 truncate text-sm",
                    stat.status !== "ok" && "text-destructive"
                  )}
                >
                  {stat.display_name}
                </span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    stat.status === "ok"
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
                >
                  {stat.status === "ok"
                    ? `${stat.result_count} result${stat.result_count !== 1 ? "s" : ""}`
                    : stat.status === "timeout"
                      ? "timed out"
                      : "error"}
                </span>

                {/* Hover tooltip for errors */}
                {stat.status !== "ok" && stat.error_message && (
                  <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-52 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-lg group-hover:block">
                    {stat.error_message}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Dedup note */}
          {totalResults < totalFromEngines && (
            <p className="mt-3 text-xs text-muted-foreground">
              {totalFromEngines - totalResults} duplicate{totalFromEngines - totalResults !== 1 && "s"} removed
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />;
  if (status === "timeout")
    return <Clock className="h-4 w-4 shrink-0 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
}
