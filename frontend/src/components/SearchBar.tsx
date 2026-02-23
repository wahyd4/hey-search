import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutocomplete } from "@/hooks/useAutocomplete";

interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
  className?: string;
}

export function SearchBar({ initialQuery = "", onSearch, className }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { suggestions } = useAutocomplete(query, showSuggestions);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      setQuery(selected);
      setShowSuggestions(false);
      onSearch(selected);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
    onSearch(s);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative w-full max-w-2xl", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="search-input" className="sr-only">Search query</label>
        <input
          ref={inputRef}
          id="search-input"
          type="search"
          name="q"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search the web..."
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
          className="w-full rounded-full border border-input bg-background px-10 py-3 text-base shadow-sm
                     placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                     sm:text-lg"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-14 p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-3 rounded-full bg-primary p-1.5 text-primary-foreground hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul id="search-suggestions" role="listbox" className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onMouseDown={() => selectSuggestion(s)}
              className={cn(
                "cursor-pointer px-4 py-2 text-sm hover:bg-accent",
                i === selectedIndex && "bg-accent"
              )}
            >
              <Search className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
