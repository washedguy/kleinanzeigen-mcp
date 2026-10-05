import type { Page } from "patchright";
import type { ListingSummary } from "../types/listing.js";
import type { SearchListingsInput } from "../types/search.js";
import {
  cleanText,
  decodeHtml,
  extractSpanTexts,
  listingIdFromUrl,
  parseListingDate,
  parsePrice,
} from "./parse.js";
import { absoluteUrl, searchUrl, withSortingField } from "./urls.js";

/**
 * Extracts top-level <article> blocks, correctly skipping nested articles.
 * Pure string function so it can be unit tested with saved HTML fixtures.
 */
function extractArticleBlocks(html: string): string[] {
  const blocks: string[] = [];
  const tagRe = /<\/?article\b[^>]*>/gi;
  let depth = 0;
  let start = 0;
  for (const match of html.matchAll(tagRe)) {
    const index = match.index ?? 0;
    if (!match[0].startsWith("</")) {
      if (depth === 0) start = index;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) blocks.push(html.slice(start, index + match[0].length));
    }
  }
  return blocks;
}

const DATE_SPAN = /(heute|gestern)\b/i;
const DATE_ABSOLUTE = /^\d{1,2}\.\d{1,2}\.\d{4}$/;
const POSTAL_SPAN = /^\d{5}\b/;

export function parseSearchResults(html: string, now: Date = new Date()): ListingSummary[] {
  return extractArticleBlocks(html)
    .map((block) => parseSearchResult(block, now))
    .filter((item): item is ListingSummary => item !== null);
}

function parseSearchResult(block: string, now: Date): ListingSummary | null {
  const id = firstMatch(block, /data-adid="(\d+)"/);
  const href = firstMatch(block, /data-href="([^"]+)"/);
  if (!id || !href) return null;

  const title =
    extractTagText(block, /<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a\s*>/i) ||
    extractTagText(block, /<a[^>]*class="[^"]*ellipsis[^"]*"[^>]*>([\s\S]*?)<\/a\s*>/i);
  if (!title) return null;

  const priceHtml =
    firstMatch(block, /<p[^>]*class="[^"]*text-title3[^"]*"[^>]*>([\s\S]*?)<\/p\s*>/i) ??
    firstMatch(block, /<p[^>]*class="[^"]*boxedarticle--price[^"]*"[^>]*>([\s\S]*?)<\/p\s*>/i) ??
    "";
  const parsedPrice = parsePrice(priceHtml);

  const spans = extractSpanTexts(block);
  const location = spans.find((span) => POSTAL_SPAN.test(span) && !DATE_SPAN.test(span));
  const dateSpan = spans.find((span) => DATE_SPAN.test(span) || DATE_ABSOLUTE.test(span));

  return {
    id,
    title,
    price: parsedPrice ? parsedPrice.price : null,
    ...(location ? { location } : {}),
    url: absoluteUrl(decodeHtml(href)),
    ...(extractImage(block) ? { imageUrl: extractImage(block)! } : {}),
    ...(dateSpan ? { createdAt: parseListingDate(dateSpan, now) } : {}),
  };
}

function extractImage(block: string): string | undefined {
  const ldJson = firstMatch(block, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (ldJson) {
    const contentUrl = firstMatch(ldJson, /"contentUrl"\s*:\s*"([^"]+)"/);
    if (contentUrl) return decodeHtml(contentUrl.replace(/\\\//g, "/"));
  }
  const dataImg =
    firstMatch(block, /data-imgsrc="([^"]+)"/) ?? firstMatch(block, /<img[^>]*\bsrc="([^"]+)"/i);
  return dataImg ? decodeHtml(dataImg) : undefined;
}

function firstMatch(input: string, regex: RegExp): string | undefined {
  const match = input.match(regex);
  return match?.[1]?.trim() || undefined;
}

function extractTagText(input: string, regex: RegExp): string | undefined {
  const raw = firstMatch(input, regex);
  return raw ? cleanText(raw) : undefined;
}

export interface PaginationLink {
  page: number;
  href: string;
}

/** Parses the numbered pagination links of a results page. */
export function parsePaginationLinks(html: string): PaginationLink[] {
  const start = html.indexOf("pagination-container");
  const container = start >= 0 ? html.slice(start, start + 6000) : html;
  const links: PaginationLink[] = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of container.matchAll(anchorRe)) {
    const attrs = match[1];
    const href = attrs.match(/href="([^"]+)"/i)?.[1];
    const page = attrs.match(/aria-label="Seite\s+(\d+)"/i)?.[1];
    if (href && page) links.push({ page: Number(page), href: decodeHtml(href) });
  }
  return links;
}

export function pageNumberFromUrl(url: string): number | undefined {
  const match = url.match(/\/s-seite:(\d+)\//i);
  return match ? Number(match[1]) : undefined;
}

/** Absolute URL of the next results page, or undefined when there is none. */
export function nextPageUrl(html: string, currentPage: number): string | undefined {
  const next = parsePaginationLinks(html).find((l) => l.page === currentPage + 1);
  return next ? absoluteUrl(next.href) : undefined;
}

export interface SearchPages {
  results: ListingSummary[];
  pages: { url: string; html: string }[];
}

/**
 * Walks the current results page (already loaded) and follows pagination up to
 * `maxPages`, de-duplicating listings by id.
 */
export async function collectSearchPages(page: Page, maxPages: number): Promise<SearchPages> {
  const results: ListingSummary[] = [];
  const seen = new Set<string>();
  const pages: SearchPages["pages"] = [];

  let currentPage = pageNumberFromUrl(page.url()) ?? 1;
  let html = await page.content();

  for (;;) {
    pages.push({ url: page.url(), html });
    for (const item of parseSearchResults(html)) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        results.push(item);
      }
    }
    if (currentPage >= maxPages) break;
    const next = nextPageUrl(html, currentPage);
    if (!next) break;
    await page.goto(next, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    currentPage += 1;
    html = await page.content();
  }

  return { results, pages };
}

/** Navigates to the search results for `input`, applying sorting. */
export async function navigateToSearch(page: Page, input: SearchListingsInput): Promise<string> {
  const url = searchUrl({
    query: input.query,
    location: input.location,
    radiusKm: input.radiusKm,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const sorted = withSortingField(page.url(), input.sort);
  if (sorted !== page.url()) {
    await page.goto(sorted, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  return page.url();
}

/**
 * Stateless helper around the Kleinanzeigen search results page. Kept free of
 * MCP concerns; the `searchListings` facade in index.ts wires it to the browser.
 */
export class SearchPage {
  constructor(private readonly page: Page) {}

  async search(input: SearchListingsInput, maxPages = 1): Promise<SearchPages> {
    await navigateToSearch(this.page, input);
    return collectSearchPages(this.page, maxPages);
  }

  async searchFromUrl(url: string, maxPages = 1): Promise<SearchPages> {
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle").catch(() => undefined);
    return collectSearchPages(this.page, maxPages);
  }
}

export { listingIdFromUrl };
