import { useState, useEffect, useRef, useCallback } from "react";
import { autocomplete } from "@/lib/api";

export function useAutocomplete(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || !enabled) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const results = await autocomplete(q);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  return { suggestions, loading };
}
