import type { Page } from "patchright";
import { ChallengeRequiredError, RateLimitError } from "../utils/errors.js";

const CHALLENGE_SELECTORS = [
  "#challenge-form",
  "form[action*='challenge']",
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  ".g-recaptcha",
  "#captcha",
];

const CHALLENGE_TEXT_MARKERS = [
  "just a moment",
  "unusual traffic",
  "verify you are human",
  "bist du ein mensch",
  "sicherheitsüberprüfung",
  "bitte bestätige, dass du",
  "captcha",
];

const RATE_LIMIT_MARKERS = ["zu viele anfragen", "too many requests", "rate limit"];

/** Detects Kleinanzeigen anti-bot challenges without attempting to solve them. */
async function detectChallenge(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes("challenge") || url.includes("captcha")) return true;

  for (const selector of CHALLENGE_SELECTORS) {
    if (
      await page
        .locator(selector)
        .first()
        .count()
        .catch(() => 0)
    ) {
      return true;
    }
  }

  const body = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return CHALLENGE_TEXT_MARKERS.some((marker) => body.includes(marker));
}

/** Throws when the current page is a challenge or a rate-limit page. */
export async function guardPage(page: Page): Promise<void> {
  if (await detectChallenge(page)) throw new ChallengeRequiredError();
  const body = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  if (RATE_LIMIT_MARKERS.some((marker) => body.includes(marker))) {
    throw new RateLimitError();
  }
}
