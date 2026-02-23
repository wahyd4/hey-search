import { useState, useEffect } from "react";
import { Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { getEngines, toggleEngine, type EngineInfo } from "@/lib/api";

interface EngineSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function EngineSettings({ open, onClose }: EngineSettingsProps) {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      getEngines().then(setEngines).finally(() => setLoading(false));
    }
  }, [open]);

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      const updated = await toggleEngine(name, enabled);
      setEngines((prev) => prev.map((e) => (e.name === updated.name ? updated : e)));
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5" />
            Search Engines
          </h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Done
          </button>
        </div>

        {loading ? (
          <p className="py-4 text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {engines.map((engine) => (
              <div
                key={engine.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{engine.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[engine.supports_web && "Web", engine.supports_images && "Images"]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(engine.name, !engine.enabled)}
                  className="text-foreground"
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
        )}
      </div>
    </div>
  );
}
