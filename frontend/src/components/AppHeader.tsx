import { useState, useEffect, useRef } from "react";
import { Menu, X, Settings, BookmarkIcon, Images, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  onGoHome: () => void;
  onShowSettings: () => void;
  onShowBookmarks: () => void;
  onShowGallery: () => void;
  /** Makes header transparent + white text (for home page with background image) */
  transparent?: boolean;
  /** Optional center content (e.g. search bar) */
  children?: React.ReactNode;
}

export function AppHeader({
  onGoHome,
  onShowSettings,
  onShowBookmarks,
  onShowGallery,
  transparent = false,
  children,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const base = transparent
    ? "border-transparent bg-transparent"
    : "border-b bg-background/95 backdrop-blur";

  const iconCls = transparent
    ? "text-white/80 hover:text-white hover:bg-white/10"
    : "text-muted-foreground hover:bg-accent";

  const logoCls = transparent
    ? "text-white font-bold"
    : "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold";

  const dropdownCls = "absolute right-0 top-full mt-2 w-48 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden";

  const menuItem = (
    icon: React.ReactNode,
    label: string,
    action: () => void,
    isLink?: boolean,
    href?: string,
  ) => {
    const cls = "flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
    if (isLink && href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setMenuOpen(false)}>
          {icon}
          {label}
        </a>
      );
    }
    return (
      <button className={cls} onClick={() => { action(); setMenuOpen(false); }}>
        {icon}
        {label}
      </button>
    );
  };

  return (
    <header className={cn("sticky top-0 z-40 border", base)}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Logo */}
        <button
          onClick={onGoHome}
          aria-label="Go to homepage"
          className={cn("shrink-0 text-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded", logoCls)}
        >
          HS
        </button>

        {/* Center slot */}
        {children && <div className="flex-1 min-w-0">{children}</div>}

        {/* Spacer when no center content */}
        {!children && <div className="flex-1" />}

        {/* Menu button */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={cn(
              "rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              iconCls
            )}
          >
            {menuOpen
              ? <X className="h-5 w-5" aria-hidden="true" />
              : <Menu className="h-5 w-5" aria-hidden="true" />
            }
          </button>

          {menuOpen && (
            <div className={dropdownCls} role="menu" aria-label="Site navigation">
              {menuItem(<Settings className="h-4 w-4" />, "Settings", onShowSettings)}
              {menuItem(<BookmarkIcon className="h-4 w-4" />, "Bookmarks", onShowBookmarks)}
              {menuItem(<Images className="h-4 w-4" />, "Backgrounds", onShowGallery)}
              <div className="mx-3 border-t" />
              {menuItem(<ExternalLink className="h-4 w-4" />, "API Docs", () => {}, true, "/docs")}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
