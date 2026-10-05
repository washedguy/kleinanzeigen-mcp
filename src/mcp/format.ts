import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toMcpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Wraps a structured result as MCP text content. */
function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Wraps any error as a safe MCP error result. */
function errorResult(err: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(toMcpError(err), null, 2) }],
    isError: true,
  };
}

/**
 * Turns a tool implementation into a safe MCP handler: it serializes the
 * returned data as JSON and maps thrown errors to safe error results, logging
 * them server-side without leaking internals to the client.
 */
export function handleTool<Args>(
  name: string,
  handler: (args: Args) => Promise<unknown>,
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args): Promise<CallToolResult> => {
    try {
      return jsonResult(await handler(args));
    } catch (err) {
      const payload = toMcpError(err);
      if (payload.error === "INTERNAL_ERROR") {
        logger.error(`tool ${name} failed`, err instanceof Error ? err.message : String(err));
      } else {
        logger.warn(`tool ${name}: ${payload.error}`, payload.message);
      }
      return errorResult(err);
    }
  };
}
