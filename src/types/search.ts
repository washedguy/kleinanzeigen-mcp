export type SearchSort = "relevance" | "newest" | "price_asc" | "price_desc";

export interface SearchListingsInput {
  query: string;
  location?: string;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: SearchSort;
  /** How many result pages to walk (1 = first page only). */
  maxPages?: number;
  /** Internal: max number of results to collect. Not exposed to the MCP client. */
  limit?: number;
}
