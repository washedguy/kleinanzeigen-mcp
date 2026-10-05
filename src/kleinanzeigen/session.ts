import type { Page } from "patchright";
import {
  AuthenticationRequiredError,
  ChallengeRequiredError,
  NavigationError,
  RateLimitError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { BASE_URL, LOGIN_PATH, LOGIN_URL } from "./urls.js";

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
    )
      return true;
  }

  const body = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return CHALLENGE_TEXT_MARKERS.some((marker) => body.includes(marker));
}

async function isOnLoginPage(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes(LOGIN_PATH)) return true;
  if (url.includes("/m-einloggen")) return true;
  // The current SSO login flow runs on a separate host with step paths
  // (login-identifier, login-password, custom-prompt).
  if (url.includes("login.kleinanzeigen.de")) return true;
  const passwordField = await page
    .locator("input[type='password'], #login-form, form[action*='einloggen']")
    .first()
    .count()
    .catch(() => 0);
  return passwordField > 0;
}

const VERIFY_URL =
  /verify|verification|two-factor|2fa|mfa|einmalcode|bestaetigung|\/sms|challenge/i;
const VERIFY_SELECTORS = [
  "input[autocomplete='one-time-code']",
  "input[name*='code' i]",
  "input[id*='code' i]",
  "input[name*='otp' i]",
  "input[name*='token' i]",
];
const VERIFY_TEXT = [
  "sms-code",
  "sms code",
  "bestätigungscode",
  "bestaetigungscode",
  "sicherheitscode",
  "einmalcode",
  "verifizier",
  "code eingeben",
  "code per sms",
  "identität bestätigen",
  "identitaet bestaetigen",
  "6-stelligen code",
  "zwei-faktor",
  "2-faktor",
];

/**
 * Detects an in-progress 2FA / SMS-code verification step. These pages look
 * like neither the login form nor a logged-in page, so they must never be
 * mistaken for a completed login (and the browser must not be closed).
 */
async function isVerificationPage(page: Page): Promise<boolean> {
  if (VERIFY_URL.test(page.url())) return true;
  for (const selector of VERIFY_SELECTORS) {
    if (
      (await page
        .locator(selector)
        .first()
        .count()
        .catch(() => 0)) > 0
    )
      return true;
  }
  const body = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return VERIFY_TEXT.some((marker) => body.includes(marker));
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector).first();
  if ((await locator.count().catch(() => 0)) === 0) return false;
  return locator.isVisible().catch(() => false);
}

/**
 * Positive authenticated-state check. Requires an account marker to be visible
 * and the logged-out "Einloggen" button to be absent, so ambiguous pages
 * (spinners, verification, redirects) are not treated as a completed login.
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  if (await isOnLoginPage(page)) return false;
  if (
    await isVisible(
      page,
      '[data-testid="login-button"], a[href*="m-einloggen"], a[href*="m-benutzer-anmeldung"]',
    )
  ) {
    return false;
  }
  return isVisible(
    page,
    'a[href*="m-abmelden"], a[href*="m-meine-anzeigen"], a[href*="m-einstellungen"], ' +
      '[data-testid="nav-menu-item-my-ads-item"], [data-testid="user-menu"], [data-testid*="avatar" i]',
  );
}

const RATE_LIMIT_MARKERS = ["zu viele anfragen", "too many requests", "rate limit"];

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

/**
 * Ensures the persistent browser session is logged in. Navigates to the inbox,
 * which redirects to the SSO login page when there is no valid session.
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  try {
    await page.goto(`${BASE_URL}/m-nachrichten.html`, {
      waitUntil: "domcontentloaded",
    });
  } catch (err) {
    throw new NavigationError(err instanceof Error ? err.message : String(err));
  }

  if (await detectChallenge(page)) {
    logger.warn("challenge detected while checking session");
    throw new ChallengeRequiredError();
  }
  if (await isVerificationPage(page)) {
    logger.warn("unfinished verification detected while checking session");
    throw new AuthenticationRequiredError();
  }
  if (await isOnLoginPage(page)) {
    logger.warn("no valid login session");
    throw new AuthenticationRequiredError();
  }
  logger.debug("authenticated");
}

/**
 * Opens the Kleinanzeigen login page in a visible browser and waits until the
 * user has fully logged in manually. Used by `npm run login`.
 *
 * Important: while waiting we only inspect the current page, we never navigate.
 * Navigating would reload the page and wipe the credentials or the SMS / 2FA
 * code the user is typing. Login is only considered complete on a positive
 * authenticated signal, so intermediate pages (spinner, SMS verification,
 * redirect) never cause an early close.
 */
export async function waitForManualLogin(page: Page, timeoutMs = 15 * 60 * 1000): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  logger.info("waiting for manual login in visible browser");
  logger.info("if a verification step appears, enter the code in the browser - it stays open");

  let confirmations = 0;
  let lastNotice = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.isClosed()) {
      // The user may simply have closed the window after logging in. Re-open a
      // page and verify the session before declaring failure.
      try {
        const fresh = await page.context().newPage();
        await ensureAuthenticated(fresh);
        logger.info("login detected after browser was closed");
        return;
      } catch {
        throw new AuthenticationRequiredError("Browser was closed before login completed.");
      }
    }
    try {
      if (await detectChallenge(page)) {
        if (lastNotice !== "challenge") {
          logger.info("challenge shown - please solve it in the browser");
          lastNotice = "challenge";
          confirmations = 0;
        }
        await page.waitForTimeout(3000);
        continue;
      }

      if (await isVerificationPage(page)) {
        if (lastNotice !== "verify") {
          logger.info("verification step detected - enter the code in the browser, waiting...");
          lastNotice = "verify";
          confirmations = 0;
        }
        await page.waitForTimeout(2000);
        continue;
      }

      if (await isLoggedIn(page)) {
        confirmations += 1;
        lastNotice = "";
        // Require two consecutive positive checks, then confirm against a
        // protected page. If the session is not actually valid, we keep waiting
        // instead of closing the browser.
        if (confirmations >= 2) {
          try {
            await ensureAuthenticated(page);
            logger.info("login detected");
            return;
          } catch (err) {
            if (
              err instanceof AuthenticationRequiredError ||
              err instanceof ChallengeRequiredError
            ) {
              confirmations = 0;
            } else {
              throw err;
            }
          }
        }
      } else {
        confirmations = 0;
      }
    } catch {
      // Page may be mid-navigation; keep waiting.
    }
    await page.waitForTimeout(2000);
  }
  throw new AuthenticationRequiredError("Timed out waiting for manual login.");
}
