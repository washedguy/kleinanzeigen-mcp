import os from "node:os";
import path from "node:path";

const HOME_DIR_NAME = ".kleinanzeigen-mcp";

export function getDataDir(): string {
  const override = process.env.KLEINANZEIGEN_MCP_HOME;
  if (override && override.trim().length > 0) return path.resolve(override);
  return path.join(os.homedir(), HOME_DIR_NAME);
}

export function getBrowserProfileDir(): string {
  return path.join(getDataDir(), "browser-profile");
}
