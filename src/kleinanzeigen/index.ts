import type { Listing, ListingSummary } from "../types/listing.js";
import type { SearchListingsInput } from "../types/search.js";
import { InvalidInputError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { saveSnapshot } from "../utils/snapshots.js";
import { browser } from "./browser.js";
import { ListingPage } from "./listing.js";
import { SearchPage } from "./search.js";
import { guardPage } from "./session.js";

const MAX_PAGES_LIMIT = 10;

function resolveMaxPages(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidInputError("`maxPages` must be a positive integer.");
  }
  return Math.min(value, MAX_PAGES_LIMIT);
}

function validateSearchInput(input: SearchListingsInput): string {
  const query = input.query?.trim();
  if (!query) throw new InvalidInputError("`query` must not be empty.");
  if (
    input.minPrice !== undefined &&
    input.maxPrice !== undefined &&
    input.minPrice > input.maxPrice
  ) {
    throw new InvalidInputError("`minPrice` must not be greater than `maxPrice`.");
  }
  return query;
}

export async function searchListings(input: SearchListingsInput): Promise<ListingSummary[]> {
  const query = validateSearchInput(input);
  const maxPages = resolveMaxPages(input.maxPages);
  const page = await browser.getPage();
  logger.info("search started", { query, maxPages, sort: input.sort });
  const searchPage = new SearchPage(page);
  const { results, pages } = await searchPage.search({ ...input, query }, maxPages);
  await guardPage(page);
  for (const p of pages) saveSnapshot("search", p.url, p.html);
  const limit = input.limit ?? 25;
  logger.info("search completed", { query, pages: pages.length, results: results.length });
  return results.slice(0, limit);
}

export async function getListing(params: { id?: string; url?: string }): Promise<Listing> {
  const target = params.url ?? params.id;
  if (!target || target.trim().length === 0) {
    throw new InvalidInputError("Either `id` or `url` must be provided.");
  }
  const page = await browser.getPage();
  logger.info("listing opened");
  const listingPage = new ListingPage(page);
  const { listing, html } = await listingPage.open(target.trim());
  await guardPage(page);
  saveSnapshot("listing", listing.url, html);
  return listing;
}

export async function closeBrowser(): Promise<void> {
  await browser.stop();
}
