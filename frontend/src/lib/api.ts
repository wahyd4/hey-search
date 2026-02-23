const API_BASE = "/api";

export interface WebResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

export interface ImageResult {
  title: string;
  url: string;
  img_src: string;
  thumbnail_src: string;
  source: string;
  engine: string;
}

export interface EngineError {
  engine: string;
  message: string;
  is_timeout: boolean;
}

export interface SearchResponse {
  query: string;
  category: string;
  results: (WebResult | ImageResult)[];
  errors: EngineError[];
  suggestions: string[];
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
  page: number = 1
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, category, page: String(page) });
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
