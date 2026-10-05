export const BASE_URL = "https://www.kleinanzeigen.de";

export const LOGIN_PATH = "/m-einloggen.html";
export const INBOX_PATH = "/m-nachrichten.html";
export const SAVED_SEARCHES_PATH = "/m-meine-suchen.html";

export const LOGIN_URL = `${BASE_URL}${LOGIN_PATH}`;
export const INBOX_URL = `${BASE_URL}${INBOX_PATH}`;
export const SAVED_SEARCHES_URL = `${BASE_URL}${SAVED_SEARCHES_PATH}`;

export function absoluteUrl(hrefOrPath: string): string {
  if (!hrefOrPath) return BASE_URL;
  if (/^https?:\/\//i.test(hrefOrPath)) return hrefOrPath;
  return `${BASE_URL}${hrefOrPath.startsWith("/") ? "" : "/"}${hrefOrPath}`;
}

export function searchUrl(params: {
  query: string;
  location?: string;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}): string {
  const search = new URLSearchParams();
  search.set("keywords", params.query);
  if (params.location) search.set("locationStr", params.location);
  if (params.radiusKm !== undefined) search.set("radius", String(params.radiusKm));
  if (params.minPrice !== undefined) search.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) search.set("maxPrice", String(params.maxPrice));
  // Note: sortingField is intentionally NOT sent here because the
  // s-suchanfrage.html redirect drops it. It is applied to the canonical URL
  // afterwards via `withSortingField`.
  return `${BASE_URL}/s-suchanfrage.html?${search.toString()}`;
}

/**
 * Values extracted from Kleinanzeigen's own sorting control
 * (SortingControls component). "relevance" intentionally omits the parameter.
 */
export function sortingFieldValue(sort?: string): string | null {
  switch (sort) {
    case "newest":
      return "SORTING_DATE";
    case "price_asc":
      return "PRICE_AMOUNT";
    case "price_desc":
      return "PRICE_AMOUNT_DESC";
    default:
      return null;
  }
}

/** Appends the sortingField query parameter to a canonical search URL. */
export function withSortingField(url: string, sort?: string): string {
  const value = sortingFieldValue(sort);
  if (!value) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("sortingField", value);
    return parsed.toString();
  } catch {
    return url;
  }
}
