import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { EngineError } from "@/lib/api";

interface ErrorToastProps {
  errors: EngineError[];
}

export function ErrorToast({ errors }: ErrorToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [errors]);

  if (!errors.length || !visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm space-y-2">
      {errors.map((err, i) => (
        <div
          key={`${err.engine}-${i}`}
          className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-card p-3 shadow-lg animate-in slide-in-from-bottom-5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 text-sm">
            <p className="font-medium">{err.engine} failed</p>
            <p className="text-muted-foreground">{err.message}</p>
          </div>
          <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
