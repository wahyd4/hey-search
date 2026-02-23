import { useState, useEffect, type FormEvent } from "react";
import { Ban, Plus, Trash2 } from "lucide-react";
import { getExcludedDomains, addExcludedDomain, removeExcludedDomain } from "@/lib/api";

interface ExcludedDomainsProps {
  open: boolean;
  onClose: () => void;
}

export function ExcludedDomains({ open, onClose }: ExcludedDomainsProps) {
  const [domains, setDomains] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      getExcludedDomains()
        .then(setDomains)
        .finally(() => setLoading(false));
    }
  }, [open]);

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
            <Ban className="h-5 w-5" />
            Excluded Domains
          </h2>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Done
          </button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          Results from these domains will be hidden from search results.
        </p>

        {/* Add form */}
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

        {error && (
          <p className="mb-2 text-sm text-destructive">{error}</p>
        )}

        {/* Domain list */}
        {loading ? (
          <p className="py-4 text-center text-muted-foreground">Loading...</p>
        ) : domains.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No excluded domains yet. Add one above.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {domains.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-mono truncate">{domain}</span>
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
    </div>
  );
}
