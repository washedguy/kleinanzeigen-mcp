#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import type { Page } from "patchright";
import { browser } from "./kleinanzeigen/browser.js";
import { logger } from "./utils/logger.js";
import { saveSnapshot, snapshotDir } from "./utils/snapshots.js";

/**
 * Debug capture mode.
 *
 * Opens a visible browser with the persistent profile so you can log in and
 * browse around. Every page (and SPA route change) is written to disk as HTML,
 * so the parsers can later be tuned against real markup.
 *
 *   npm run debug
 *   KLEINANZEIGEN_SNAPSHOT_DIR=/tmp/ka-snaps npm run debug
 */
const outDir = snapshotDir() ?? path.join(process.cwd(), "debug-snapshots");
process.env.KLEINANZEIGEN_SNAPSHOT_DIR = outDir;

const timers = new WeakMap<Page, NodeJS.Timeout>();
const lastUrl = new WeakMap<Page, string>();

function schedule(page: Page): void {
  const existing = timers.get(page);
  if (existing) clearTimeout(existing);
  timers.set(
    page,
    setTimeout(() => void snapshot(page), 1200),
  );
}

async function snapshot(page: Page): Promise<void> {
  try {
    if (page.isClosed()) return;
    const url = page.url();
    if (!url || url === "about:blank") return;
    const html = await page.content();
    if (!html || html.length < 200) return;
    lastUrl.set(page, url);
    saveSnapshot("browse", url, html);
  } catch {
    // Ignore pages that navigate away while we read them.
  }
}

function attach(page: Page): void {
  lastUrl.set(page, "");
  page.on("load", () => schedule(page));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) schedule(page);
  });
  page.on("close", () => {
    const timer = timers.get(page);
    if (timer) clearTimeout(timer);
  });
  schedule(page);
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  logger.info(`debug capture enabled -> ${outDir}`);
  logger.info("log in and browse; each page is saved as HTML. Ctrl+C to stop.");

  await browser.start({ headless: false });
  const context = browser.getContext();
  if (!context) throw new Error("browser context unavailable");

  context.pages().forEach(attach);
  context.on("page", attach);

  // Backup poll for client-side route changes that do not fire a navigation.
  const poll = setInterval(() => {
    for (const page of context.pages()) {
      try {
        if (!page.isClosed() && lastUrl.get(page) !== page.url()) {
          schedule(page);
        }
      } catch {
        // ignore
      }
    }
  }, 1500);

  const shutdown = async () => {
    clearInterval(poll);
    await browser.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  context.on("close", () => {
    clearInterval(poll);
    logger.info("browser closed, exiting debug capture");
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error("debug capture failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
