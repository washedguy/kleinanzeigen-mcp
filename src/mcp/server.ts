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
        "Unofficial, read-only server for public kleinanzeigen.de listings. " +
        "Use search_listings to find listings (query; optional location, radiusKm, " +
        "minPrice, maxPrice, sort, maxPages) and get_listing to read one listing by " +
        "id or url. Public data only: no login, no account access, no messaging, no " +
        "bulk scraping, no challenge bypass. On CHALLENGE_REQUIRED or RATE_LIMITED, " +
        "retry later with fewer, slower requests.",
    },
  );

  registerSearchTools(server);
  registerListingTools(server);

  return server;
}
