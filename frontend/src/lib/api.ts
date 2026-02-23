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
}

export async function getSettings(): Promise<AppSettings> {
  const resp = await fetch(`${API_BASE}/settings`);
  if (!resp.ok) throw new Error("Failed to fetch settings");
  return resp.json();
}

export async function updateSettings(settings: { cache_ttl_hours?: number; redis_url?: string }): Promise<AppSettings> {
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
