import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListingTools } from "./tools/listings.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerSavedSearchTools } from "./tools/saved-searches.js";
import { registerSearchTools } from "./tools/search.js";

export const SERVER_NAME = "kleinanzeigen-mcp";
export const SERVER_VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Unofficial, user-directed MCP server for kleinanzeigen.de, acting on the " +
        "user's own logged-in account in the local browser. Read tools " +
        "(search_listings, get_listing, get_conversations, get_conversation, " +
        "get_saved_searches, run_saved_search) are safe. search_listings supports " +
        "location, radiusKm, sort and maxPages. Mutating tools (send_message, " +
        "save_search, delete_saved_search) change the user's account and should " +
        "require explicit user approval. The server never generates message content, " +
        "never bypasses challenges, and performs no bulk scraping or messaging.",
    },
  );

  registerSearchTools(server);
  registerListingTools(server);
  registerMessageTools(server);
  registerSavedSearchTools(server);

  return server;
}
