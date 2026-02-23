import { useState, useEffect, type FormEvent } from "react";
import { Settings, ToggleLeft, ToggleRight, Plus, Trash2, ExternalLink } from "lucide-react";
import { getEngines, toggleEngine, type EngineInfo } from "@/lib/api";
import { getExcludedDomains, addExcludedDomain, removeExcludedDomain } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "engines" | "excluded";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

export function SettingsModal({ open, onClose, initialTab = "engines" }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 flex w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 pt-5 pb-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Settings
          </h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Done
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {([
            { key: "engines" as const, label: "Engines" },
            { key: "excluded" as const, label: "Excluded Sites" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors",
                tab === key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {tab === key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {tab === "engines" && <EnginesTab />}
          {tab === "excluded" && <ExcludedTab />}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            API Documentation — try requests interactively
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Engines tab ────────────────────────────────────────── */

function EnginesTab() {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEngines().then(setEngines).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      const updated = await toggleEngine(name, enabled);
      setEngines((prev) => prev.map((e) => (e.name === updated.name ? updated : e)));
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    }
  };

  if (loading) return <p className="py-4 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Enable or disable search engines. Disabled engines are skipped during search.
      </p>
      {engines.map((engine) => (
        <div key={engine.name} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">{engine.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {[engine.supports_web && "Web", engine.supports_images && "Images"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button onClick={() => handleToggle(engine.name, !engine.enabled)} className="text-foreground">
            {engine.enabled ? (
              <ToggleRight className="h-8 w-8 text-green-500" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Excluded Sites tab ─────────────────────────────────── */

function ExcludedTab() {
  const [domains, setDomains] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getExcludedDomains()
      .then(setDomains)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const domain = input.trim();
    if (!domain) return;
    setError("");
    try {
      const updated = await addExcludedDomain(domain);
      setDomains(updated);
      setInput("");
    } catch {
      setError("Failed to add domain");
    }
  };

  const handleRemove = async (domain: string) => {
    try {
      const updated = await removeExcludedDomain(domain);
      setDomains(updated);
    } catch {
      setError("Failed to remove domain");
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Results from these domains will be hidden from search results.
      </p>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. example.com"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-80 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-4 text-center text-muted-foreground">Loading…</p>
      ) : domains.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No excluded domains yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {domains.map((domain) => (
            <li key={domain} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="truncate font-mono text-sm">{domain}</span>
              <button
                onClick={() => handleRemove(domain)}
                className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
