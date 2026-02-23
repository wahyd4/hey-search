const API_BASE = "/api";

export interface WebResult {
  result_id: string;
  title: string;
  url: string;
  content: string;
  engine: string;
  rank: number;
}

export interface ImageResult {
  result_id: string;
  title: string;
  url: string;
  img_src: string;
  thumbnail_src: string;
  source: string;
  engine: string;
  rank: number;
  width: number;
  height: number;
}

export interface EngineError {
  engine: string;
  message: string;
  is_timeout: boolean;
  code: string;
  details: string;
  retry_hint: string;
}

export interface EngineStat {
  engine: string;
  display_name: string;
  result_count: number;
  status: "ok" | "error" | "timeout";
  error_message: string;
}

export interface SearchResponse {
  query: string;
  category: string;
  page: number;
  results: (WebResult | ImageResult)[];
  errors: EngineError[];
  suggestions: string[];
  engine_stats: EngineStat[];
  timestamp: string;
  total_results: number;
  has_next: boolean;
  cached: boolean;
}

export interface EngineInfo {
  name: string;
  display_name: string;
  enabled: boolean;
  supports_web: boolean;
  supports_images: boolean;
}

export interface AutocompleteResponse {
  query: string;
  suggestions: string[];
}

export async function search(
  query: string,
  category: "web" | "images" = "web",
  page: number = 1,
  imageSize: string = ""
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, category, page: String(page) });
  if (imageSize) params.set("image_size", imageSize);
  const resp = await fetch(`${API_BASE}/search?${params}`);
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  return resp.json();
}

export async function autocomplete(query: string): Promise<string[]> {
  const params = new URLSearchParams({ q: query });
  const resp = await fetch(`${API_BASE}/autocomplete?${params}`);
  if (!resp.ok) return [];
  const data: AutocompleteResponse = await resp.json();
  return data.suggestions;
}

export async function getEngines(): Promise<EngineInfo[]> {
  const resp = await fetch(`${API_BASE}/engines`);
  if (!resp.ok) throw new Error("Failed to fetch engines");
  return resp.json();
}

export async function toggleEngine(
  name: string,
  enabled: boolean
): Promise<EngineInfo> {
  const resp = await fetch(`${API_BASE}/engines/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!resp.ok) throw new Error("Failed to toggle engine");
  return resp.json();
}

export function isImageResult(r: WebResult | ImageResult): r is ImageResult {
  return "img_src" in r;
}

// --- Excluded Domains ---

export interface ExcludedDomainsResponse {
  domains: string[];
}

export async function getExcludedDomains(): Promise<string[]> {
  const resp = await fetch(`${API_BASE}/excluded-domains`);
  if (!resp.ok) return [];
  const data: ExcludedDomainsResponse = await resp.json();
  return data.domains;
}

export async function addExcludedDomain(domain: string): Promise<string[]> {
  const resp = await fetch(`${API_BASE}/excluded-domains`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!resp.ok) throw new Error("Failed to add domain");
  const data: ExcludedDomainsResponse = await resp.json();
  return data.domains;
}

export async function removeExcludedDomain(domain: string): Promise<string[]> {
  const resp = await fetch(`${API_BASE}/excluded-domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
  if (!resp.ok) throw new Error("Failed to remove domain");
  const data: ExcludedDomainsResponse = await resp.json();
  return data.domains;
}

// --- Settings ---

export interface AppSettings {
  cache_ttl_hours: number;
  cache_available: boolean;
  redis_url: string;
  bg_enabled: boolean;
  bg_refresh_minutes: number;
}

export async function getSettings(): Promise<AppSettings> {
  const resp = await fetch(`${API_BASE}/settings`);
  if (!resp.ok) throw new Error("Failed to fetch settings");
  return resp.json();
}

export async function updateSettings(settings: { cache_ttl_hours?: number; redis_url?: string; bg_enabled?: boolean; bg_refresh_minutes?: number }): Promise<AppSettings> {
  const resp = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!resp.ok) throw new Error("Failed to update settings");
  return resp.json();
}

export async function flushCache(): Promise<{ keys_deleted: number; message: string }> {
  const resp = await fetch(`${API_BASE}/cache`, { method: "DELETE" });
  if (!resp.ok) throw new Error("Failed to flush cache");
  return resp.json();
}

// --- Background ---

export interface BackgroundInfo {
  filename: string | null;
  url: string | null;
  source_url: string | null;
  enabled: boolean;
}

export interface BackgroundListItem {
  filename: string;
  url: string;
  source_url: string;
  size_bytes: number;
  created_at: number;
}

export async function getBackground(): Promise<BackgroundInfo> {
  const resp = await fetch(`${API_BASE}/background`);
  if (!resp.ok) throw new Error("Failed to fetch background");
  return resp.json();
}

export async function refreshBackground(): Promise<BackgroundInfo> {
  const resp = await fetch(`${API_BASE}/background/refresh`, { method: "POST" });
  if (!resp.ok) throw new Error("Failed to refresh background");
  return resp.json();
}

export async function listBackgrounds(page = 1, perPage = 20): Promise<BackgroundListItem[]> {
  const resp = await fetch(`${API_BASE}/backgrounds?page=${page}&per_page=${perPage}`);
  if (!resp.ok) throw new Error("Failed to list backgrounds");
  return resp.json();
}

// --- Bookmarks ---

export interface Bookmark {
  id: string;
  type: "web" | "image";
  title: string;
  url: string;
  content: string;
  img_src: string;
  thumbnail_src: string;
  source: string;
  engine: string;
  width: number;
  height: number;
  created_at: string;
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
  total: number;
  page: number;
  per_page: number;
}

export async function getBookmarks(page = 1, perPage = 30, type = ""): Promise<BookmarkListResponse> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (type) params.set("type", type);
  const resp = await fetch(`${API_BASE}/bookmarks?${params}`);
  if (!resp.ok) throw new Error("Failed to fetch bookmarks");
  return resp.json();
}

export async function getBookmarkedUrls(): Promise<Set<string>> {
  const resp = await fetch(`${API_BASE}/bookmarks/urls`);
  if (!resp.ok) throw new Error("Failed to fetch bookmarked URLs");
  const data: { urls: string[] } = await resp.json();
  return new Set(data.urls);
}

export async function addBookmark(data: {
  type: "web" | "image";
  title: string;
  url: string;
  content?: string;
  img_src?: string;
  thumbnail_src?: string;
  source?: string;
  engine?: string;
  width?: number;
  height?: number;
}): Promise<Bookmark> {
  const resp = await fetch(`${API_BASE}/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error("Failed to add bookmark");
  return resp.json();
}

export async function removeBookmark(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/bookmarks/${id}`, { method: "DELETE" });
  if (!resp.ok) throw new Error("Failed to remove bookmark");
}

export async function removeBookmarkByUrl(url: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/bookmarks/by-url/${encodeURIComponent(url)}`, { method: "DELETE" });
  if (!resp.ok) throw new Error("Failed to remove bookmark");
}

// --- Analytics ---

export interface StatsSummary {
  period_days: number;
  total_searches: number;
  total_clicks: number;
  top_queries: { query: string; count: number }[];
  top_clicked_urls: { url: string; title: string; engine: string; count: number }[];
  top_positions: { position: number; count: number }[];
  engine_clicks: { engine: string; count: number }[];
  daily_searches: { date: string; searches: number }[];
}

export async function trackClick(data: {
  query: string;
  category: string;
  position: number;
  url: string;
  title: string;
  engine: string;
}): Promise<void> {
  // fire-and-forget — don't block the user
  fetch(`${API_BASE}/stats/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}

export async function fetchStats(days = 7): Promise<StatsSummary> {
  const resp = await fetch(`${API_BASE}/stats?days=${days}`);
  if (!resp.ok) throw new Error("Failed to fetch stats");
  return resp.json();
}
