import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListingTools } from "./tools/listings.js";
import { registerSearchTools } from "./tools/search.js";

const pkg = createRequire(import.meta.url)("../../package.json") as { version?: string };

export const SERVER_NAME = "kleinanzeigen-mcp";
export const SERVER_VERSION = pkg.version ?? "0.0.0";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Unofficial, read-only MCP server for public kleinanzeigen.de listings. " +
        "search_listings searches listings (query, location, radiusKm, minPrice, " +
        "maxPrice, sort, maxPages); get_listing reads a single listing by id or url. " +
        "It never logs in, never touches any account, sends no messages, and performs " +
        "no bulk scraping. Challenges are never bypassed.",
    },
  );

  registerSearchTools(server);
  registerListingTools(server);

  return server;
}
