import { useState, useEffect, type FormEvent } from "react";
import { Settings, ToggleLeft, ToggleRight, Plus, Trash2, ExternalLink, Database, ImageIcon, GripVertical } from "lucide-react";
import { getEngines, toggleEngine, reorderEngines, type EngineInfo } from "@/lib/api";
import { getExcludedDomains, addExcludedDomain, removeExcludedDomain } from "@/lib/api";
import { getSettings, updateSettings, flushCache, type AppSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "engines" | "excluded" | "cache" | "background";

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-2xl sm:max-h-[80vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 pt-5 pb-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Settings
          </h2>
          <button onClick={onClose} aria-label="Close settings" className="text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded">
            Done
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {([
            { key: "engines" as const, label: "Engines" },
            { key: "excluded" as const, label: "Excluded Sites" },
            { key: "cache" as const, label: "Cache" },
            { key: "background" as const, label: "Background" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "engines" && <EnginesTab />}
          {tab === "excluded" && <ExcludedTab />}
          {tab === "cache" && <CacheTab />}
          {tab === "background" && <BackgroundTab />}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-6 py-3">
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    getEngines()
      .then((list) => setEngines([...list].sort((a, b) => a.order - b.order)))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      const updated = await toggleEngine(name, enabled);
      setEngines((prev) => prev.map((e) => (e.name === updated.name ? { ...updated, order: e.order } : e)));
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...engines];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const withOrder = reordered.map((eng, i) => ({ ...eng, order: i }));
    setEngines(withOrder);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      const updated = await reorderEngines(withOrder.map((eng) => eng.name));
      setEngines([...updated].sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error("Failed to reorder engines:", err);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (loading) return <p className="py-4 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag to set result priority order. Toggle to enable or disable.
      </p>
      {engines.map((engine, index) => (
        <div
          key={engine.name}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 transition-all select-none",
            dragIndex === index ? "opacity-50" : "",
            dragOverIndex === index && dragIndex !== index ? "ring-2 ring-primary border-primary" : "",
          )}
        >
          <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true" />
          <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">{index + 1}.</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{engine.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {[engine.supports_web && "Web", engine.supports_images && "Images"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={() => handleToggle(engine.name, !engine.enabled)}
            className="shrink-0 text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
            aria-label={`${engine.enabled ? "Disable" : "Enable"} ${engine.display_name}`}
          >
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
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Add domain"
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-80 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
                aria-label={`Remove ${domain}`}
                className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

/* ── Cache tab ──────────────────────────────────────────── */

const TTL_PRESETS = [
  { label: "Disabled", hours: 0 },
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

function CacheTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushMsg, setFlushMsg] = useState("");
  const [ttl, setTtl] = useState(6);
  const [redisUrl, setRedisUrl] = useState("");
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlMsg, setUrlMsg] = useState("");

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setTtl(s.cache_ttl_hours);
        setRedisUrl(s.redis_url);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (hours: number) => {
    setTtl(hours);
    setSaving(true);
    try {
      const updated = await updateSettings({ cache_ttl_hours: hours });
      setSettings(updated);
    } catch (err) {
      console.error("Failed to update cache TTL:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUrlSave = async () => {
    setUrlSaving(true);
    setUrlMsg("");
    try {
      const updated = await updateSettings({ redis_url: redisUrl.trim() });
      setSettings(updated);
      setUrlMsg(updated.cache_available ? "Connected ✓" : redisUrl.trim() ? "Connection failed" : "Disconnected");
    } catch {
      setUrlMsg("Failed to save");
    } finally {
      setUrlSaving(false);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    setFlushMsg("");
    try {
      const result = await flushCache();
      setFlushMsg(result.message);
    } catch {
      setFlushMsg("Failed to flush cache");
    } finally {
      setFlushing(false);
    }
  };

  if (loading) return <p className="py-4 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Redis URL configuration */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Redis Connection</p>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Enter a Redis URL to enable search result caching (e.g. redis://localhost:6379).
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={redisUrl}
            onChange={(e) => { setRedisUrl(e.target.value); setUrlMsg(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlSave(); }}
            placeholder="redis://host:port"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Redis URL"
          />
          <button
            onClick={handleUrlSave}
            disabled={urlSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {urlSaving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            settings?.cache_available ? "bg-green-500" : "bg-muted-foreground"
          )} />
          <span className="text-xs text-muted-foreground">
            {settings?.cache_available ? "Connected" : "Disconnected"}
          </span>
          {urlMsg && (
            <span className={cn("text-xs font-medium", urlMsg.includes("✓") ? "text-green-600 dark:text-green-400" : urlMsg === "Disconnected" ? "text-muted-foreground" : "text-destructive")}>
              — {urlMsg}
            </span>
          )}
        </div>
      </div>

      {/* TTL selection */}
      <div>
        <label className="text-sm font-medium block mb-2">Cache duration</label>
        <div className="flex flex-wrap gap-2">
          {TTL_PRESETS.map((preset) => (
            <button
              key={preset.hours}
              onClick={() => handleSave(preset.hours)}
              disabled={saving || !settings?.cache_available}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40",
                ttl === preset.hours
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:bg-accent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Custom slider */}
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={168}
            step={1}
            value={ttl}
            disabled={!settings?.cache_available}
            onChange={(e) => setTtl(Number(e.target.value))}
            onMouseUp={() => handleSave(ttl)}
            onTouchEnd={() => handleSave(ttl)}
            className="flex-1 accent-primary disabled:opacity-40"
            aria-label="Cache TTL hours"
          />
          <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
            {ttl === 0 ? "Off" : ttl < 24 ? `${ttl}h` : `${(ttl / 24).toFixed(1)}d`}
          </span>
        </div>
      </div>

      {/* Flush button */}
      <div className="border-t pt-4">
        <button
          onClick={handleFlush}
          disabled={flushing || !settings?.cache_available}
          className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {flushing ? "Flushing…" : "Clear all cached results"}
        </button>
        {flushMsg && <p className="mt-2 text-xs text-muted-foreground">{flushMsg}</p>}
      </div>
    </div>
  );
}

const BG_REFRESH_PRESETS = [
  { minutes: 1, label: "1 min" },
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "1 day" },
];

function BackgroundTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshMin, setRefreshMin] = useState(30);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setRefreshMin(s.bg_refresh_minutes);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({ bg_enabled: !settings?.bg_enabled });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshSave = async (min: number) => {
    setRefreshMin(min);
    setSaving(true);
    try {
      const updated = await updateSettings({ bg_refresh_minutes: min });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-4 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Enable/disable */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Homepage Background</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Show a random nature/landscape image from Unsplash on the home page.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          aria-label={settings?.bg_enabled ? "Disable background" : "Enable background"}
          className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded disabled:opacity-50"
        >
          {settings?.bg_enabled ? (
            <ToggleRight className="h-8 w-8 text-primary" />
          ) : (
            <ToggleLeft className="h-8 w-8 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Refresh interval */}
      <div className={cn(!settings?.bg_enabled && "opacity-50 pointer-events-none")}>
        <label className="text-sm font-medium block mb-2">Refresh interval</label>
        <div className="flex flex-wrap gap-2">
          {BG_REFRESH_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => handleRefreshSave(preset.minutes)}
              disabled={saving}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40",
                refreshMin === preset.minutes
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:bg-accent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Slider */}
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={1440}
            step={1}
            value={refreshMin}
            onChange={(e) => setRefreshMin(Number(e.target.value))}
            onMouseUp={() => handleRefreshSave(refreshMin)}
            onTouchEnd={() => handleRefreshSave(refreshMin)}
            className="flex-1 accent-primary"
            aria-label="Background refresh interval minutes"
          />
          <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
            {refreshMin < 60 ? `${refreshMin}m` : refreshMin < 1440 ? `${(refreshMin / 60).toFixed(1)}h` : "1 day"}
          </span>
        </div>
      </div>
    </div>
  );
}
