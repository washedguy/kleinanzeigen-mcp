import type { Page } from "patchright";
import type { Listing, ListingSeller } from "../types/listing.js";
import { ListingNotFoundError, NavigationError } from "../utils/errors.js";
import {
  cleanText,
  decodeHtml,
  listingIdFromUrl,
  normalizeWhitespace,
  parseListingDate,
  parsePrice,
} from "./parse.js";
import { absoluteUrl } from "./urls.js";

const NOT_FOUND_MARKERS = [
  "anzeige ist nicht mehr verfügbar",
  "diese anzeige gibt es nicht mehr",
  "wurde gelöscht",
  "seite nicht gefunden",
];

export function parseListing(html: string, url: string, now: Date = new Date()): Listing {
  const rawTitle = extract(html, /<h1[^>]*id="viewad-title"[^>]*>([\s\S]*?)<\/h1\s*>/i);
  const title = rawTitle ? normalizeTitle(cleanText(rawTitle)) : "";

  if (!title || looksMissing(html)) {
    throw new ListingNotFoundError();
  }

  const priceHtml = extract(html, /<h2[^>]*id="viewad-price"[^>]*>([\s\S]*?)<\/h2\s*>/i) ?? "";
  const parsedPrice = parsePrice(priceHtml);

  const description = cleanMultiline(
    extract(html, /id="viewad-description-text"[^>]*>([\s\S]*?)<\/p\s*>/i) ?? "",
  );

  const location = cleanText(
    extract(html, /id="viewad-locality"[^>]*>([\s\S]*?)<\/span\s*>/i) ?? "",
  );

  const extraInfo =
    extract(html, /id="viewad-extra-info"[^>]*>([\s\S]*?)<\/div\s*>\s*<\/div\s*>/i) ?? "";
  const dateSpan = extract(extraInfo, /<span[^>]*>([\s\S]*?)<\/span\s*>/i);

  const images = extractImages(html);

  return {
    id: listingIdFromUrl(url) ?? extract(html, /data-adid="(\d+)"/) ?? hashFromUrl(url),
    url: absoluteUrl(url),
    title,
    description: description || "",
    price: parsedPrice ? parsedPrice.price : null,
    ...(parsedPrice?.negotiable ? { negotiable: true } : {}),
    ...(location ? { location } : {}),
    ...(extractSeller(html) ? { seller: extractSeller(html)! } : {}),
    images,
    ...(dateSpan ? { createdAt: parseListingDate(dateSpan, now) } : {}),
  };
}

function looksMissing(html: string): boolean {
  const lower = html.toLowerCase();
  return NOT_FOUND_MARKERS.some((marker) => lower.includes(marker));
}

/** Strips leading status labels such as "Reserviert •" / "Gelöscht •" from the title. */
function normalizeTitle(title: string): string {
  return title.replace(/^(?:(?:reserviert|gelöscht|verkauft)\s*•\s*)+/i, "").trim();
}

function cleanMultiline(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");
  const decoded = decodeHtml(withBreaks.replace(/<[^>]*>/g, ""));
  return decoded
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImages(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/data-imgsrc="([^"]+)"/gi)) {
    urls.add(decodeHtml(match[1]).replace(/\\\//g, "/"));
  }
  if (urls.size === 0) {
    for (const match of html.matchAll(/"contentUrl"\s*:\s*"([^"]+)"/gi)) {
      urls.add(decodeHtml(match[1]).replace(/\\\//g, "/"));
    }
  }
  return [...urls];
}

const SELLER_BLACKLIST =
  /über uns|impressum|datenschutz|hilfe|agb|kontakt|merkliste|anzeige teilen/i;

function extractSeller(html: string): ListingSeller | undefined {
  const rawName =
    extract(html, /contactName\s*:\s*"([^"]*)"/i) ?? extract(html, /contactName\s*:\s*'([^']*)'/i);
  const rawType = extract(html, /sellerType\s*[:=]\s*['"]?([a-zA-ZäöüÄÖÜ_]+)['"]?/i);
  const commercialFlag = extract(html, /isCommercialUser\s*:\s*(true|false)/i);

  const name = rawName ? cleanText(decodeHtml(rawName)) : "";
  const validName = name && name.length <= 60 && !SELLER_BLACKLIST.test(name) ? name : undefined;

  const type: ListingSeller["type"] =
    rawType && /commercial|gewerblich/i.test(rawType)
      ? "commercial"
      : rawType && /private|privat/i.test(rawType)
        ? "private"
        : commercialFlag === "true"
          ? "commercial"
          : commercialFlag === "false"
            ? "private"
            : undefined;

  if (!type && !validName) return undefined;
  return {
    ...(validName ? { name: validName } : {}),
    ...(type ? { type } : {}),
  };
}

function extract(input: string, regex: RegExp): string | undefined {
  const match = input.match(regex);
  return match?.[1] ?? undefined;
}

function hashFromUrl(url: string): string {
  return url.replace(/[^a-z0-9]/gi, "").slice(-16);
}

export class ListingPage {
  constructor(private readonly page: Page) {}

  async open(idOrUrl: string): Promise<{ listing: Listing; html: string }> {
    const url = normalizeListingUrl(idOrUrl);
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (err) {
      throw new NavigationError(err instanceof Error ? err.message : String(err));
    }
    await this.page.waitForLoadState("networkidle").catch(() => undefined);
    const html = await this.page.content();
    return { listing: parseListing(html, this.page.url()), html };
  }
}

function normalizeListingUrl(idOrUrl: string): string {
  if (/^https?:\/\//i.test(idOrUrl)) return idOrUrl;
  if (idOrUrl.startsWith("/")) return absoluteUrl(idOrUrl);
  const digits = idOrUrl.replace(/\D/g, "");
  if (!digits) throw new ListingNotFoundError("Listing id is not valid.");
  return `${"https://www.kleinanzeigen.de"}/s-anzeige/${digits}`;
}
