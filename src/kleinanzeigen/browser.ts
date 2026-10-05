import fs from "node:fs";
import { type Browser, type BrowserContext, chromium, type Page } from "patchright";
import { NavigationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface StartOptions {
  headless?: boolean;
}

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ],
  win32: [
    `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
};

/**
 * Resolves the Chromium channel. Real Google Chrome is preferred when present
 * because it exposes `window.chrome` and realistic plugins, which the bundled
 * Chromium build lacks. Override with KLEINANZEIGEN_CHANNEL (e.g. "chrome",
 * "chromium", "msedge"); set it to "bundled" to force the built-in build.
 */
function resolveChannel(): string | undefined {
  const explicit = process.env.KLEINANZEIGEN_CHANNEL?.trim().toLowerCase();
  if (explicit === "bundled" || explicit === "chromium") return undefined;
  if (explicit) return explicit;

  const candidates = CHROME_PATHS[process.platform] ?? [];
  return candidates.some((p) => p && fs.existsSync(p)) ? "chrome" : undefined;
}

/**
 * Central Patchright abstraction. Lazily starts a single headless browser and
 * reuses one page for all calls. No profile or session is persisted: this server
 * only reads public pages.
 */
export class KleinanzeigenBrowser {
  private browserInstance: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private starting: Promise<void> | null = null;

  async start(options: StartOptions = {}): Promise<void> {
    if (this.context) return;
    if (this.starting) return this.starting;
    this.starting = this.doStart(options).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async doStart(options: StartOptions): Promise<void> {
    const headless = options.headless ?? envHeadless();
    const channel = resolveChannel();
    try {
      this.browserInstance = await chromium.launch({
        headless,
        ...(channel ? { channel } : {}),
      });
      this.context = await this.browserInstance.newContext({
        viewport: { width: 1366, height: 900 },
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        acceptDownloads: false,
      });
    } catch (err) {
      await this.browserInstance?.close().catch(() => undefined);
      this.browserInstance = null;
      this.context = null;
      const message = err instanceof Error ? err.message : String(err);
      throw new NavigationError(`Could not start Chromium. (${message.slice(0, 200)})`);
    }
    this.context.setDefaultTimeout(20_000);
    this.page = await this.context.newPage();
    logger.info("browser started", { headless, channel: channel ?? "bundled-chromium" });
  }

  async getPage(): Promise<Page> {
    await this.start();
    if (!this.page || this.page.isClosed()) {
      this.page = await this.context!.newPage();
    }
    return this.page;
  }

  /** The browser context, once started. Used by the debug capture mode. */
  getContext(): BrowserContext | null {
    return this.context;
  }

  async stop(): Promise<void> {
    const instance = this.browserInstance;
    this.browserInstance = null;
    this.context = null;
    this.page = null;
    if (instance) {
      await instance.close().catch(() => undefined);
      logger.info("browser stopped");
    }
  }
}

function envHeadless(): boolean {
  const value = process.env.KLEINANZEIGEN_HEADLESS;
  if (value === undefined) return true;
  return !(value === "false" || value === "0" || value === "no");
}

export const browser = new KleinanzeigenBrowser();
