import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getListing } from "../../kleinanzeigen/index.js";
import { InvalidInputError } from "../../utils/errors.js";
import { handleTool } from "../format.js";

interface GetListingArgs {
  id?: string;
  url?: string;
}

const getListingSchema = {
  id: z.string().optional().describe("Kleinanzeigen ad id."),
  url: z.string().url().optional().describe("Full listing URL."),
};

export function registerListingTools(server: McpServer): void {
  server.registerTool(
    "get_listing",
    {
      title: "Get listing",
      description:
        "Open a single Kleinanzeigen listing and return its normalized details. " +
        "Provide either `id` or `url`. Read-only.",
      inputSchema: getListingSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    handleTool<GetListingArgs>("get_listing", async (args) => {
      if (!args.id && !args.url) {
        throw new InvalidInputError("Either `id` or `url` must be provided.");
      }
      return getListing({ id: args.id, url: args.url });
    }),
  );
}
