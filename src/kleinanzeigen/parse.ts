const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  euro: "€",
  szlig: "ß",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
};

/** Decodes the HTML entities that appear in Kleinanzeigen markup. */
export function decodeHtml(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : safeFromCodePoint(code);
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : safeFromCodePoint(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, " "));
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function cleanText(html: string): string {
  return normalizeWhitespace(stripTags(html));
}

const FREE_MARKERS = ["zu verschenken", "gratis", "kostenlos"];
const NEGOTIABLE_MARKERS = ["vb", "verhandlungsbasis", "vhs"];

export interface ParsedPrice {
  price: number | null;
  negotiable: boolean;
}

/**
 * Parses German price strings such as "1.699 €", "500 € VB",
 * "Zu verschenken" or "VB".
 */
export function parsePrice(raw: string): ParsedPrice | null {
  const text = normalizeWhitespace(decodeHtml(raw)).toLowerCase();
  if (!text) return null;

  const negotiable = NEGOTIABLE_MARKERS.some((marker) => matchesToken(text, marker));
  if (FREE_MARKERS.some((marker) => text.includes(marker))) {
    return { price: 0, negotiable };
  }

  const match = text.match(/(\d[\d.,]*)/);
  if (!match) {
    return { price: null, negotiable };
  }
  return { price: parseGermanNumber(match[1]), negotiable };
}

function matchesToken(text: string, token: string): boolean {
  if (token.length <= 3) {
    return new RegExp(`(^|[^a-zäöü])${token}([^a-zäöü]|$)`, "i").test(text);
  }
  return text.includes(token);
}

/** Parses "1.699" -> 1699, "1.699,50" -> 1699.5, "1,50" -> 1.5. */
function parseGermanNumber(raw: string): number | null {
  let value = raw.trim();
  const hasThousands = /\.\d{3}(\.|,|$)/.test(value) || /^\d{1,3}(\.\d{3})+$/.test(value);
  if (hasThousands) {
    value = value.replace(/\./g, "");
    value = value.replace(",", ".");
  } else {
    value = value.replace(/,(?=\d{1,2}$)/, ".");
  }
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

/** Converts "Heute, 16:56", "Gestern, 09:12" or "05.10.2026" to an ISO string. */
export function parseListingDate(raw: string, now: Date = new Date()): string | undefined {
  const text = normalizeWhitespace(decodeHtml(raw));
  if (!text) return undefined;

  const absolute = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (absolute) {
    const [, d, m, y] = absolute;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const relative = text.match(/(heute|gestern)(?:,\s*(\d{1,2}):(\d{2}))?/i);
  if (relative) {
    const base = new Date(now);
    if (relative[1].toLowerCase() === "gestern") base.setDate(base.getDate() - 1);
    const hours = relative[2] ? Number(relative[2]) : 0;
    const minutes = relative[3] ? Number(relative[3]) : 0;
    base.setHours(hours, minutes, 0, 0);
    return base.toISOString();
  }
  return undefined;
}

/** Extracts the numeric ad id from a Kleinanzeigen listing URL. */
export function listingIdFromUrl(url: string): string | undefined {
  const match =
    url.match(/-(\d{6,})(?:-\d+-\d+)?(?:[/?#]|$)/) ??
    url.match(/\/(\d{6,})(?:-\d+-\d+)?(?:[/?#]|$)/);
  return match?.[1];
}

/** Extracts all plain-text values of <span> elements from an HTML fragment. */
export function extractSpanTexts(html: string): string[] {
  const spans: string[] = [];
  for (const match of html.matchAll(/<span[^>]*>([\s\S]*?)<\/span\s*>/gi)) {
    const text = cleanText(match[1]);
    if (text) spans.push(text);
  }
  return spans;
}
