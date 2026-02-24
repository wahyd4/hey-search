import { useState, useEffect } from "react";
import { GripVertical, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { getEngines, toggleEngine, reorderEngines, type EngineInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

interface EngineSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function EngineSettings({ open, onClose }: EngineSettingsProps) {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getEngines()
        .then((list) => setEngines([...list].sort((a, b) => a.order - b.order)))
        .finally(() => setLoading(false));
    }
  }, [open]);

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
    const withUpdatedOrder = reordered.map((eng, i) => ({ ...eng, order: i }));
    setEngines(withUpdatedOrder);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      const updated = await reorderEngines(withUpdatedOrder.map((eng) => eng.name));
      setEngines([...updated].sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error("Failed to reorder engines:", err);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
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
          <>
            <p className="mb-3 text-xs text-muted-foreground">Drag to set result priority order. Toggle to enable or disable.</p>
            <div className="space-y-2">
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
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true" />
                  <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{engine.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[engine.supports_web && "Web", engine.supports_images && "Images"]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(engine.name, !engine.enabled)}
                    className="shrink-0 text-foreground"
                    aria-label={engine.enabled ? `Disable ${engine.display_name}` : `Enable ${engine.display_name}`}
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
          </>
        )}
      </div>
    </div>
  );
}
