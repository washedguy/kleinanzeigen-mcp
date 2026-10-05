import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  deleteSavedSearch,
  getSavedSearches,
  runSavedSearch,
  saveSearch,
} from "../../kleinanzeigen/index.js";
import type { SearchListingsInput } from "../../types/search.js";
import { handleTool } from "../format.js";

const SORT_VALUES = ["relevance", "newest", "price_asc", "price_desc"] as const;

interface RunSavedSearchArgs {
  id: string;
  maxPages?: number;
}

interface DeleteSavedSearchArgs {
  id: string;
}

const getSavedSearchesSchema = {};

const runSavedSearchSchema = {
  id: z.string().min(1).describe("Saved search id from get_saved_searches."),
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("How many result pages to fetch (1-10, default 1)."),
};

const saveSearchSchema = {
  query: z.string().min(1).describe("Search keywords to save."),
  location: z.string().optional().describe("Optional location or postal code."),
  radiusKm: z.number().int().positive().max(200).optional().describe("Search radius in km."),
  minPrice: z.number().nonnegative().optional().describe("Minimum price in EUR."),
  maxPrice: z.number().nonnegative().optional().describe("Maximum price in EUR."),
  sort: z.enum(SORT_VALUES).optional().describe("Sort order. Defaults to relevance."),
};

const deleteSavedSearchSchema = {
  id: z.string().min(1).describe("Saved search id from get_saved_searches."),
};

export function registerSavedSearchTools(server: McpServer): void {
  server.registerTool(
    "get_saved_searches",
    {
      title: "Get saved searches",
      description: "List the logged-in user's saved searches (Suchaufträge). Read-only.",
      inputSchema: getSavedSearchesSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleTool("get_saved_searches", async () => ({ savedSearches: await getSavedSearches() })),
  );

  server.registerTool(
    "run_saved_search",
    {
      title: "Run saved search",
      description: "Run one of the user's saved searches by id and return its listings. Read-only.",
      inputSchema: runSavedSearchSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleTool<RunSavedSearchArgs>("run_saved_search", async (args) => ({
      results: await runSavedSearch(args.id, args.maxPages ?? 1),
    })),
  );

  server.registerTool(
    "save_search",
    {
      title: "Save search",
      description:
        "MUTATING ACTION: saves the given search as a Suchauftrag on the user's account. " +
        "Requires user approval.",
      inputSchema: saveSearchSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    handleTool<SearchListingsInput>("save_search", (args) => saveSearch(args)),
  );

  server.registerTool(
    "delete_saved_search",
    {
      title: "Delete saved search",
      description:
        "MUTATING ACTION: deletes a saved search (Suchauftrag) by id. Requires user approval.",
      inputSchema: deleteSavedSearchSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    handleTool<DeleteSavedSearchArgs>("delete_saved_search", (args) => deleteSavedSearch(args.id)),
  );
}
