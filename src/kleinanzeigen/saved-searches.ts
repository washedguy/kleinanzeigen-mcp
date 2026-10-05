import type { Page } from "patchright";
import type { SavedSearch } from "../types/search.js";
import { cleanText, decodeHtml, parseListingDate } from "./parse.js";
import { absoluteUrl, SAVED_SEARCHES_URL } from "./urls.js";

/**
 * Saved searches ("Suchaufträge") are server-rendered on /m-meine-suchen.html.
 * Each entry is a list item carrying the id in `data-saved-search`.
 */
export function parseSavedSearches(html: string): SavedSearch[] {
  const items = html.matchAll(
    /<li\b[^>]*data-saved-search="(\d+)"[^>]*>([\s\S]*?)(?=<li\b[^>]*data-saved-search=|<ul\b|<\/ul>|$)/gi,
  );
  const results: SavedSearch[] = [];
  for (const item of items) {
    const id = item[1];
    const body = item[2];
    const title = extractText(body, /<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a\s*>/i);
    const isNew = /saved-searches-badge[^>]*>\s*neu\b/i.test(body) || />\s*neu\s*</i.test(body);
    const dateText = body.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/)?.[0];
    const lastResultAt = dateText ? parseListingDate(dateText) : undefined;

    results.push({
      id,
      ...(title ? { name: title, query: title } : {}),
      url: absoluteUrl(`/m-suche-verwenden.html?id=${id}`),
      ...(isNew ? { isNew: true } : {}),
      ...(lastResultAt ? { lastResultAt } : {}),
    });
  }
  return results;
}

function extractText(input: string, regex: RegExp): string | undefined {
  const raw = input.match(regex)?.[1];
  const text = raw ? cleanText(decodeHtml(raw)) : "";
  return text.length > 0 ? text : undefined;
}

interface RawSavedSearch {
  id: string;
  name?: string;
  isNew?: boolean;
}

/** De-duplicates extracted records (multiple anchors share one saved search). */
export function normalizeSavedSearchRecords(
  records: RawSavedSearch[],
  baseUrl = "https://www.kleinanzeigen.de",
): SavedSearch[] {
  const byId = new Map<string, SavedSearch>();
  for (const record of records) {
    if (!/^\d+$/.test(record.id)) continue;
    const existing = byId.get(record.id);
    const name = existing?.name ?? record.name;
    byId.set(record.id, {
      id: record.id,
      ...(name ? { name, query: name } : {}),
      url: `${baseUrl}/m-suche-verwenden.html?id=${record.id}`,
      ...(existing?.isNew || record.isNew ? { isNew: true } : {}),
      ...(existing?.lastResultAt ? { lastResultAt: existing.lastResultAt } : {}),
    });
  }
  return [...byId.values()];
}

/**
 * Extracts saved searches from the hydrated React list. Titles live in
 * `aria-label` (Zur Suche "..." wechseln) or the anchor text; the "NEU" badge is
 * a separate anchor pointing at the same id.
 */
async function extractSavedSearchesFromDom(page: Page): Promise<SavedSearch[]> {
  const records = await page
    .evaluate(() => {
      const root = document.querySelector('[data-testid="saved-searches-list"]');
      if (!root) return [];
      const out: { id: string; name?: string; isNew?: boolean }[] = [];
      root.querySelectorAll('a[href*="m-suche-verwenden"]').forEach((a) => {
        const href = a.getAttribute("href") ?? "";
        const id = href.match(/id=(\d+)/)?.[1];
        if (!id) return;
        const aria = a.getAttribute("aria-label") ?? "";
        const fromAria = aria.match(/Zur Suche "(.+?)" wechseln/)?.[1];
        const text = (a.textContent ?? "").replace(/\s+/g, " ").trim();
        const name = fromAria ?? (text && text !== "NEU" ? text : undefined);
        out.push({ id, ...(name ? { name } : {}), ...(text === "NEU" ? { isNew: true } : {}) });
      });
      return out;
    })
    .catch(() => []);
  return normalizeSavedSearchRecords(records);
}

export class SavedSearchesPage {
  constructor(private readonly page: Page) {}

  async list(): Promise<{ savedSearches: SavedSearch[]; html: string }> {
    await this.page.goto(SAVED_SEARCHES_URL, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle").catch(() => undefined);
    await this.page.waitForTimeout(1500);
    const html = await this.page.content();
    let savedSearches = parseSavedSearches(html);
    if (savedSearches.length === 0) {
      savedSearches = await extractSavedSearchesFromDom(this.page);
    }
    return { savedSearches, html };
  }
}

/**
 * Save/delete contract (reverse-engineered from the SavedSearchService bundle):
 *   POST /m-suche-abonnieren.json   body = searchFormParams, header x-csrf-token
 *   POST /m-suche-loeschen.json     body = searchFormParams, header x-csrf-token
 * The parameters come from the SavedSearchBar astro-island props.
 */
export interface SaveSearchContext {
  csrfToken: string;
  createUrl: string;
  deleteUrl: string;
  formParams: Record<string, unknown>;
}

/** Unwraps Astro's `[type, payload]` island prop serialization. */
export function deserializeAstroProps(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (typeof value[0] === "number" && value.length <= 2) {
      // `[type, payload]` wrapper; `[0]` encodes undefined.
      if (value.length === 1) return undefined;
      const payload = value[1];
      if (Array.isArray(payload)) return payload.map(deserializeAstroProps);
      if (payload && typeof payload === "object") {
        return deserializeAstroProps(payload as Record<string, unknown>);
      }
      return payload;
    }
    return value.map(deserializeAstroProps);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) out[key] = deserializeAstroProps(val);
    return out;
  }
  return value;
}

/** Serializes search form params exactly like the web app (skip empty values). */
export function serializeSearchFormParams(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

export async function readSaveSearchContext(page: Page): Promise<SaveSearchContext | null> {
  const raw = await page
    .evaluate(() => {
      const el = document.querySelector('astro-island[component-url*="SavedSearchBar"]');
      return el ? el.getAttribute("props") : null;
    })
    .catch(() => null);
  if (!raw) return null;
  try {
    const props = deserializeAstroProps(JSON.parse(raw)) as Record<string, unknown>;
    const model = props.savedSearchesSubscribeModel as
      | { createUrl?: string; deleteUrl?: string }
      | undefined;
    const formParams = props.searchFormParams as Record<string, unknown> | undefined;
    if (!props.csrfToken || !model?.createUrl || !model?.deleteUrl || !formParams) return null;
    return {
      csrfToken: String(props.csrfToken),
      createUrl: model.createUrl,
      deleteUrl: model.deleteUrl,
      formParams,
    };
  } catch {
    return null;
  }
}

async function postForm(
  page: Page,
  url: string,
  csrfToken: string,
  body: string,
): Promise<boolean> {
  return page.evaluate(
    async (args: { url: string; csrf: string; body: string }) => {
      const response = await fetch(args.url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-csrf-token": args.csrf,
        },
        body: args.body,
      });
      return response.ok;
    },
    { url, csrf: csrfToken, body },
  );
}

export async function submitSaveSearch(page: Page, context: SaveSearchContext): Promise<boolean> {
  return postForm(
    page,
    context.createUrl,
    context.csrfToken,
    serializeSearchFormParams(context.formParams),
  );
}

export async function submitDeleteSavedSearch(
  page: Page,
  context: SaveSearchContext,
): Promise<boolean> {
  return postForm(
    page,
    context.deleteUrl,
    context.csrfToken,
    serializeSearchFormParams(context.formParams),
  );
}
