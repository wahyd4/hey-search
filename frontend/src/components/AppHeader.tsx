import { useState, useEffect, useRef } from "react";
import { Menu, X, Settings, BookmarkIcon, Images, ExternalLink, BarChart2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowGallery: () => void;
  onShowStats: () => void;
  onShowHistory?: () => void;
  /** Hides the logo button (used on the home page) */
  hideLogo?: boolean;
  /** Transparent header overlay (home page with background image) */
  transparent?: boolean;
  /** Optional center content (e.g. search bar) */
  children?: React.ReactNode;
}

const NAV_ITEMS = [
  { id: "docs",      icon: ExternalLink, label: "API Docs",    href: "/docs" },
  { id: "stats",     icon: BarChart2,    label: "Stats",       href: null },
  { id: "history",   icon: Clock,        label: "History",     href: null },
  { id: "gallery",   icon: Images,       label: "Backgrounds", href: null },
  { id: "bookmarks", icon: BookmarkIcon, label: "Bookmarks",   href: null },
  { id: "settings",  icon: Settings,     label: "Settings",    href: null },
] as const;

export function AppHeader({
  onGoHome,
  onShowSettings,
  onShowBookmarks,
  onShowGallery,
  onShowStats,
  onShowHistory,
  hideLogo = false,
  transparent = false,
  children,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setMenuOpen(false);

  const actions: Record<string, () => void> = {
    settings:  () => { onShowSettings();  close(); },
    bookmarks: () => { onShowBookmarks(); close(); },
    gallery:   () => { onShowGallery();   close(); },
    stats:     () => { onShowStats();     close(); },
    history:   () => { onShowHistory?.(); close(); },
    docs:      close,
  };

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const headerBase = transparent
    ? "border-transparent bg-transparent"
    : "border-b bg-background/95 backdrop-blur";

  const btnBase = cn(
    "rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    transparent
      ? "text-white/80 hover:text-white hover:bg-white/10"
      : "text-muted-foreground hover:bg-accent"
  );

  const dropdownItemBase = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    "text-foreground hover:bg-accent"
  );

  return (
    <header
      className={cn("sticky top-0 z-40 border", headerBase)}
      style={transparent ? { paddingTop: "env(safe-area-inset-top, 0px)" } : undefined}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Logo — hidden on home page */}
        {!hideLogo && (
          <button
            onClick={onGoHome}
            aria-label="Go to homepage"
            className="shrink-0 text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
            style={{ color: "#27ae60" }}
          >
            <span className="sm:hidden">HS</span>
            <span className="hidden sm:inline">HeySearch</span>
          </button>
        )}

        {/* Center slot */}
        {children
          ? <div className="flex-1 min-w-0">{children}</div>
          : <div className="flex-1" />
        }

        {/* Menu toggle */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className={btnBase}
          >
            <span
              className="block transition-transform duration-200"
              style={{ transform: menuOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              {menuOpen
                ? <X className="h-5 w-5" aria-hidden="true" />
                : <Menu className="h-5 w-5" aria-hidden="true" />
              }
            </span>
          </button>

          {/* Dropdown panel */}
          <div
            className={cn(
              "absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-lg",
              "bg-background/95 backdrop-blur",
              "overflow-hidden transition-all duration-200 origin-top-right",
              menuOpen
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none"
            )}
            role="menu"
            aria-label="Navigation menu"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (item.href) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    className={dropdownItemBase}
                    onClick={close}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {item.label}
                  </a>
                );
              }
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  onClick={actions[item.id]}
                  className={dropdownItemBase}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
