import { useState, useEffect, useRef } from "react";
import { Menu, X, Settings, BookmarkIcon, Images, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowGallery: () => void;
  /** Hides the logo button (used on the home page) */
  hideLogo?: boolean;
  /** Transparent header overlay (home page with background image) */
  transparent?: boolean;
  /** Optional center content (e.g. search bar) */
  children?: React.ReactNode;
}

// Items ordered left→right. Rightmost item (Settings) gets the shortest delay,
// so it appears first creating the right-to-left unfold effect.
const NAV_ITEMS = [
  { id: "docs",        icon: ExternalLink, label: "API Docs",    href: "/docs" },
  { id: "gallery",     icon: Images,       label: "Backgrounds", href: null },
  { id: "bookmarks",   icon: BookmarkIcon, label: "Bookmarks",   href: null },
  { id: "settings",    icon: Settings,     label: "Settings",    href: null },
] as const;

const STAGGER_MS = 60;

export function AppHeader({
  onGoHome,
  onShowSettings,
  onShowBookmarks,
  onShowGallery,
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

  const itemBase = cn(
    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap",
    "transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    transparent
      ? "text-white/80 hover:text-white hover:bg-white/10"
      : "text-muted-foreground hover:bg-accent"
  );

  return (
    <header className={cn("sticky top-0 z-40 border", headerBase)}>
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Logo — hidden on home page */}
        {!hideLogo && (
          <button
            onClick={onGoHome}
            aria-label="Go to homepage"
            className="shrink-0 text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
          >
            HS
          </button>
        )}

        {/* Center slot */}
        {children
          ? <div className="flex-1 min-w-0">{children}</div>
          : <div className="flex-1" />
        }

        {/* Right side: animated nav items + toggle button */}
        <div ref={menuRef} className="flex items-center gap-1 shrink-0">
          {/* Nav items — animate right→left on open */}
          {NAV_ITEMS.map((item, i) => {
            // Rightmost item (Settings, index 3) gets 0ms delay → appears first
            const delay = menuOpen
              ? (NAV_ITEMS.length - 1 - i) * STAGGER_MS
              : 0;

            const sharedStyle: React.CSSProperties = {
              transitionProperty: "opacity, transform",
              transitionDuration: "180ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: `${delay}ms`,
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? "translateX(0)" : "translateX(16px)",
              pointerEvents: menuOpen ? "auto" : "none",
            };

            const Icon = item.icon;

            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className={itemBase}
                  style={sharedStyle}
                  onClick={close}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                </a>
              );
            }

            return (
              <button
                key={item.id}
                onClick={actions[item.id]}
                aria-label={item.label}
                title={item.label}
                className={itemBase}
                style={sharedStyle}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}

          {/* Toggle button */}
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
        </div>
      </div>
    </header>
  );
}
