import type { Page } from "patchright";
import type { Listing, ListingSummary } from "../types/listing.js";
import type { Conversation, ConversationSummary } from "../types/message.js";
import type { SavedSearch, SearchListingsInput } from "../types/search.js";
import { InvalidInputError, ListingNotFoundError, NavigationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { saveSnapshot } from "../utils/snapshots.js";
import { browser } from "./browser.js";
import { ListingPage } from "./listing.js";
import {
  ConversationPage,
  InboxPage,
  submitMessageInConversation,
  submitMessageToListing,
} from "./messages.js";
import {
  readSaveSearchContext,
  SavedSearchesPage,
  submitDeleteSavedSearch,
  submitSaveSearch,
} from "./saved-searches.js";
import { navigateToSearch, SearchPage } from "./search.js";
import { ensureAuthenticated, guardPage } from "./session.js";
import { absoluteUrl } from "./urls.js";

const MAX_PAGES_LIMIT = 10;

function resolveMaxPages(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidInputError("`maxPages` must be a positive integer.");
  }
  return Math.min(value, MAX_PAGES_LIMIT);
}

async function publicPage(): Promise<Page> {
  const page = await browser.getPage();
  return page;
}

async function authenticatedPage(): Promise<Page> {
  const page = await browser.getPage();
  await ensureAuthenticated(page);
  await guardPage(page);
  return page;
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
  const page = await publicPage();
  logger.info("search started", { query, maxPages, sort: input.sort });
  const searchPage = new SearchPage(page);
  const { results, pages } = await searchPage.search({ ...input, query }, maxPages);
  await guardPage(page);
  for (const p of pages) saveSnapshot("search", p.url, p.html);
  const limit = input.limit ?? 25;
  logger.info("search completed", { query, pages: pages.length, results: results.length });
  return results.slice(0, limit);
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const page = await authenticatedPage();
  logger.info("saved searches loading");
  const savedSearchesPage = new SavedSearchesPage(page);
  const { savedSearches, html } = await savedSearchesPage.list();
  await guardPage(page);
  saveSnapshot("saved-searches", page.url(), html);
  return savedSearches;
}

export async function runSavedSearch(id: string, maxPages = 1): Promise<ListingSummary[]> {
  const searchId = id?.trim();
  if (!searchId || !/^\d+$/.test(searchId)) {
    throw new InvalidInputError("`id` must be a numeric saved search id.");
  }
  const pageCount = resolveMaxPages(maxPages);
  const page = await authenticatedPage();
  logger.info("saved search running", { id: searchId, maxPages: pageCount });
  const searchPage = new SearchPage(page);
  const url = absoluteUrl(`/m-suche-verwenden.html?id=${searchId}`);
  const { results, pages } = await searchPage.searchFromUrl(url, pageCount);
  await guardPage(page);
  for (const p of pages) saveSnapshot("saved-search-results", p.url, p.html);
  return results;
}

export async function saveSearch(input: SearchListingsInput): Promise<{ success: boolean }> {
  const query = validateSearchInput(input);
  const page = await authenticatedPage();
  logger.info("search saving", { query, sort: input.sort });
  await navigateToSearch(page, { ...input, query });
  await guardPage(page);
  const context = await readSaveSearchContext(page);
  if (!context) throw new NavigationError("Could not read the save-search form.");
  const ok = await submitSaveSearch(page, context);
  if (!ok) throw new NavigationError("Kleinanzeigen rejected the save-search request.");
  logger.info("search saved");
  return { success: true };
}

export async function deleteSavedSearch(id: string): Promise<{ success: boolean }> {
  const searchId = id?.trim();
  if (!searchId || !/^\d+$/.test(searchId)) {
    throw new InvalidInputError("`id` must be a numeric saved search id.");
  }
  const page = await authenticatedPage();
  logger.info("saved search deleting", { id: searchId });
  await page.goto(absoluteUrl(`/m-suche-verwenden.html?id=${searchId}`), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await guardPage(page);
  const context = await readSaveSearchContext(page);
  if (!context) throw new NavigationError("Could not read the saved-search form.");
  const ok = await submitDeleteSavedSearch(page, context);
  if (!ok) throw new NavigationError("Kleinanzeigen rejected the delete request.");
  logger.info("saved search deleted");
  return { success: true };
}

export async function getListing(params: { id?: string; url?: string }): Promise<Listing> {
  const target = params.url ?? params.id;
  if (!target || target.trim().length === 0) {
    throw new InvalidInputError("Either `id` or `url` must be provided.");
  }
  const page = await publicPage();
  logger.info("listing opened");
  const listingPage = new ListingPage(page);
  const { listing, html } = await listingPage.open(target.trim());
  await guardPage(page);
  saveSnapshot("listing", listing.url, html);
  return listing;
}

export async function getConversations(limit = 50): Promise<ConversationSummary[]> {
  const page = await authenticatedPage();
  logger.info("conversations loaded");
  const inbox = new InboxPage(page);
  const { conversations, html } = await inbox.open();
  await guardPage(page);
  saveSnapshot("inbox", page.url(), html);
  return conversations.slice(0, limit);
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const id = conversationId?.trim();
  if (!id) throw new InvalidInputError("`conversationId` must not be empty.");
  const page = await authenticatedPage();
  logger.info("conversation loaded");
  const conversationPage = new ConversationPage(page);
  const { conversation, html } = await conversationPage.open(id);
  await guardPage(page);
  saveSnapshot("conversation", page.url(), html);
  return conversation;
}

export interface SendMessageInput {
  listingId?: string;
  listingUrl?: string;
  conversationId?: string;
  message: string;
}

interface SendMessageResult {
  success: boolean;
  conversationId?: string;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const message = input.message?.trim();
  if (!message) throw new InvalidInputError("`message` must not be empty.");
  if (!input.conversationId && !input.listingId && !input.listingUrl) {
    throw new InvalidInputError("Either `conversationId` or `listingId` must be provided.");
  }
  if (input.conversationId && (input.listingId || input.listingUrl)) {
    throw new InvalidInputError("Provide either `conversationId` or `listingId`, not both.");
  }

  const page = await authenticatedPage();
  logger.info("message sending");

  let conversationId: string | undefined;
  if (input.conversationId) {
    conversationId = await submitMessageInConversation(page, input.conversationId.trim(), message);
  } else {
    const listingUrl = input.listingUrl
      ? absoluteUrl(input.listingUrl)
      : buildListingUrl(input.listingId!);
    conversationId = await submitMessageToListing(page, listingUrl, message);
  }
  await guardPage(page);
  logger.info("message sent");
  return { success: true, ...(conversationId ? { conversationId } : {}) };
}

function buildListingUrl(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (!digits) throw new ListingNotFoundError("Listing id is not valid.");
  return absoluteUrl(`/s-anzeige/${digits}`);
}

export async function closeBrowser(): Promise<void> {
  await browser.stop();
}
