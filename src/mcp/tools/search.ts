import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchListings } from "../../kleinanzeigen/index.js";
import type { SearchListingsInput } from "../../types/search.js";
import { handleTool } from "../format.js";

const SORT_VALUES = ["relevance", "newest", "price_asc", "price_desc"] as const;

const searchListingsSchema = {
  query: z.string().min(1).describe('Search keywords, e.g. "Mac Mini M4".'),
  location: z.string().optional().describe("Optional location or postal code."),
  radiusKm: z.number().int().positive().max(200).optional().describe("Search radius in km."),
  minPrice: z.number().nonnegative().optional().describe("Minimum price in EUR."),
  maxPrice: z.number().nonnegative().optional().describe("Maximum price in EUR."),
  sort: z.enum(SORT_VALUES).optional().describe("Sort order. Defaults to relevance."),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("How many result pages to fetch (1-10, default 1)."),
};

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "search_listings",
    {
      title: "Search listings",
      description:
        "Search Kleinanzeigen.de for listings and return normalized summaries. Read-only.",
      inputSchema: searchListingsSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleTool<SearchListingsInput>("search_listings", async (args) => ({
      results: await searchListings(args),
    })),
  );
}
