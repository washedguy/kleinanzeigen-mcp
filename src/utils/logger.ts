const PREFIX = "[kleinanzeigen-mcp]";

/**
 * Minimal logger. Always writes to stderr because stdout is reserved for the
 * MCP stdio transport. Never log cookies, tokens, credentials or message bodies.
 */
function write(level: string, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const base = `${timestamp} ${PREFIX} ${level} ${message}`;
  if (meta === undefined) {
    process.stderr.write(`${base}\n`);
  } else {
    process.stderr.write(`${base} ${safeMeta(meta)}\n`);
  }
}

function safeMeta(meta: unknown): string {
  try {
    const json = JSON.stringify(meta);
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return String(meta);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (process.env.LOG_LEVEL === "debug") write("DEBUG", message, meta);
  },
  info: (message: string, meta?: unknown) => write("INFO", message, meta),
  warn: (message: string, meta?: unknown) => write("WARN", message, meta),
  error: (message: string, meta?: unknown) => write("ERROR", message, meta),
};
