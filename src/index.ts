#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeBrowser } from "./kleinanzeigen/index.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} ${SERVER_VERSION} running on stdio`);

  const shutdown = async (signal: string) => {
    logger.info(`received ${signal}, shutting down`);
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (err) => {
  logger.error("fatal error", err instanceof Error ? err.message : String(err));
  await closeBrowser();
  process.exit(1);
});
