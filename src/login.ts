#!/usr/bin/env node
import { browser } from "./kleinanzeigen/browser.js";
import { waitForManualLogin } from "./kleinanzeigen/session.js";
import { logger } from "./utils/logger.js";
import { getBrowserProfileDir } from "./utils/paths.js";

/**
 * Opens a visible Chromium window using the persistent profile so the user can
 * log in to kleinzeigen.de manually. No credentials are ever read or stored.
 */
async function main(): Promise<void> {
  logger.info(`browser profile: ${getBrowserProfileDir()}`);
  await browser.start({ headless: false });
  const page = await browser.getPage();
  await waitForManualLogin(page);
  logger.info("login saved to browser profile - closing browser");
  await browser.stop();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error("login failed", err instanceof Error ? err.message : String(err));
    await browser.stop();
    process.exit(1);
  });
