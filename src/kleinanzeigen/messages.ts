import type { Page } from "patchright";
import type { Conversation, ConversationMessage, ConversationSummary } from "../types/message.js";
import { ConversationNotFoundError, NavigationError } from "../utils/errors.js";
import { absoluteUrl, INBOX_URL } from "./urls.js";

/**
 * Kleinanzeigen messagebox API types.
 *
 * Read operations use the app's own authenticated XHRs (intercepted via
 * waitForResponse) instead of scraping the client-rendered DOM. This is stable,
 * returns conversation ids and full message history, and needs no credential
 * replay.
 */
export interface MessageboxUnichatMessage {
  authorId?: string;
  payload?: { type?: string; content?: { text?: string } };
}

export interface MessageboxConversationListItem {
  id: string;
  adId?: string;
  adTitle?: string;
  adImage?: string;
  adPriceType?: string;
  role?: string;
  buyerName?: string;
  sellerName?: string;
  userIdBuyer?: number;
  userIdSeller?: number;
  unread?: boolean;
  unreadMessagesCount?: number;
  receivedDate?: string;
  textShortTrimmed?: string;
  unichatLatestMessage?: MessageboxUnichatMessage;
}

export interface MessageboxMessage {
  messageId?: string;
  textShort?: string;
  boundness?: string;
  type?: string;
  receivedDate?: string;
  unichatMessage?: MessageboxUnichatMessage;
}

export interface MessageboxConversationDetail {
  id: string;
  role?: string;
  buyerName?: string;
  sellerName?: string;
  adId?: string;
  adTitle?: string;
  adImage?: string;
  adPriceInEuroCent?: number;
  messages?: MessageboxMessage[];
}

function latestMessageText(item: {
  unichatLatestMessage?: MessageboxUnichatMessage;
  textShortTrimmed?: string;
}): string | undefined {
  const text =
    item.unichatLatestMessage?.payload?.content?.text ?? item.textShortTrimmed ?? undefined;
  return text && text.trim().length > 0 ? text.trim() : undefined;
}

function otherPartyFor(party: {
  role?: string;
  buyerName?: string;
  sellerName?: string;
}): string | undefined {
  const role = party.role?.toLowerCase();
  if (role === "buyer") return party.sellerName || undefined;
  if (role === "seller") return party.buyerName || undefined;
  return party.sellerName || party.buyerName || undefined;
}

export function mapConversationSummary(item: MessageboxConversationListItem): ConversationSummary {
  const lastMessage = latestMessageText(item);
  const otherParty = otherPartyFor(item);
  const unread = item.unread === true || (item.unreadMessagesCount ?? 0) > 0;
  return {
    id: item.id,
    ...(item.adTitle ? { title: item.adTitle, listingTitle: item.adTitle } : {}),
    ...(item.adId ? { listingId: item.adId } : {}),
    ...(otherParty ? { otherParty } : {}),
    ...(lastMessage ? { lastMessage } : {}),
    ...(item.receivedDate ? { lastMessageAt: item.receivedDate } : {}),
    ...(unread ? { unread: true } : {}),
  };
}

export function mapMessages(items: MessageboxMessage[]): ConversationMessage[] {
  return items
    .map((m) => {
      const text = (m.unichatMessage?.payload?.content?.text ?? m.textShort ?? "").trim();
      const message: ConversationMessage = {
        sender: m.boundness === "OUTBOUND" ? "me" : "other",
        text,
      };
      if (m.messageId) message.id = m.messageId;
      if (m.receivedDate) message.timestamp = m.receivedDate;
      return message;
    })
    .filter((m) => m.text.length > 0);
}

export function mapConversation(detail: MessageboxConversationDetail): Conversation {
  const otherParty = otherPartyFor(detail);
  const hasListing = Boolean(detail.adId || detail.adTitle);
  return {
    id: detail.id,
    ...(hasListing
      ? {
          listing: {
            ...(detail.adId ? { id: detail.adId } : {}),
            ...(detail.adTitle ? { title: detail.adTitle } : {}),
            ...(detail.adId ? { url: absoluteUrl(`/zur-anzeige/${detail.adId}`) } : {}),
            ...(typeof detail.adPriceInEuroCent === "number"
              ? { price: detail.adPriceInEuroCent / 100 }
              : {}),
          },
        }
      : {}),
    ...(otherParty ? { otherParty } : {}),
    messages: mapMessages(detail.messages ?? []),
  };
}

const LIST_PREDICATE = (url: string): boolean =>
  url.includes("/messagebox/api/users/") && url.includes("/conversations?page=");

function detailPredicate(conversationId: string): (url: string) => boolean {
  return (url: string) => {
    if (!url.includes("/messagebox/api/users/") || !url.includes("/conversations/")) return false;
    if (url.includes("/messages") || url.includes("/conversations?")) return false;
    return decodeURIComponent(url).includes(`/conversations/${conversationId}`);
  };
}

async function captureJson<T>(page: Page, predicate: (url: string) => boolean): Promise<T> {
  const response = await page
    .waitForResponse((r) => predicate(r.url()), { timeout: 25_000 })
    .catch(() => {
      throw new NavigationError("Messagebox API did not respond in time.");
    });
  try {
    return (await response.json()) as T;
  } catch {
    throw new NavigationError("Messagebox API returned an unreadable response.");
  }
}

export class InboxPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<{ conversations: ConversationSummary[]; html: string }> {
    const pending = captureJson<{ conversations?: MessageboxConversationListItem[] }>(
      this.page,
      LIST_PREDICATE,
    );
    await this.page.goto(INBOX_URL, { waitUntil: "domcontentloaded" });
    const data = await pending;
    const conversations = (data.conversations ?? []).map(mapConversationSummary);
    return { conversations, html: await this.page.content() };
  }
}

export class ConversationPage {
  constructor(private readonly page: Page) {}

  async open(conversationId: string): Promise<{ conversation: Conversation; html: string }> {
    const pending = captureJson<MessageboxConversationDetail>(
      this.page,
      detailPredicate(conversationId),
    );
    await this.page.goto(`${INBOX_URL}?conversationId=${encodeURIComponent(conversationId)}`, {
      waitUntil: "domcontentloaded",
    });
    const data = await pending;
    if (!data?.id) throw new ConversationNotFoundError();
    return { conversation: mapConversation(data), html: await this.page.content() };
  }
}

const COMPOSER_SELECTORS = [
  "#nachricht",
  'textarea[name="message"]',
  'textarea[placeholder*="Nachricht" i]',
  "textarea",
];

const SEND_BUTTON_NAMES = /senden|absenden|abschicken|nachricht senden/i;

async function findComposer(page: Page) {
  for (const selector of COMPOSER_SELECTORS) {
    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (count > 0 && (await locator.isVisible().catch(() => false))) return locator;
  }
  return null;
}

async function findSendButton(page: Page) {
  const testId = page.locator('[data-testid="submit-button"]').first();
  if ((await testId.count().catch(() => 0)) > 0) return testId;
  const byRole = page.getByRole("button", { name: SEND_BUTTON_NAMES }).first();
  if ((await byRole.count().catch(() => 0)) > 0) return byRole;
  for (const selector of ['button[type="submit"]', '[data-testid*="send" i]']) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0) return locator;
  }
  return null;
}

/** Reads the conversation id from a URL query, if present. */
export function conversationIdFromUrl(url: string): string | undefined {
  const match = url.match(/conversationId=([^&"#]+)/i);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Sends a message inside an already-open conversation. The MCP layer never
 * invents message content - this sends the exact text given.
 */
export async function submitMessageInConversation(
  page: Page,
  conversationId: string,
  message: string,
): Promise<string | undefined> {
  const url = `${INBOX_URL}?conversationId=${encodeURIComponent(conversationId)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const composer = await findComposer(page);
  if (!composer) throw new ConversationNotFoundError();
  await composer.click();
  await composer.fill(message);

  const sendButton = await findSendButton(page);
  if (!sendButton) throw new NavigationError("Could not find the send button.");
  await sendButton.click();
  await page.waitForTimeout(1800);
  return conversationIdFromUrl(page.url()) ?? conversationId;
}

/**
 * Sends a message to a listing by opening it, revealing the contact form and
 * submitting the given text.
 */
export async function submitMessageToListing(
  page: Page,
  listingUrl: string,
  message: string,
): Promise<string | undefined> {
  await page.goto(listingUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const contactButton = page
    .getByRole("button", { name: /nachricht schreiben|nachricht senden|kontakt/i })
    .first();
  if ((await contactButton.count().catch(() => 0)) > 0) {
    await contactButton.click().catch(() => undefined);
    await page.waitForTimeout(1000);
  }

  const composer = await findComposer(page);
  if (!composer) throw new NavigationError("Could not find the message form on the listing.");
  await composer.click();
  await composer.fill(message);

  const sendButton = await findSendButton(page);
  if (!sendButton) throw new NavigationError("Could not find the send button.");
  await sendButton.click();
  await page.waitForTimeout(2500);
  return conversationIdFromUrl(page.url());
}
