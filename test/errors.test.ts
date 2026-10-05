import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuthenticationRequiredError,
  ChallengeRequiredError,
  ListingNotFoundError,
  RateLimitError,
  toMcpError,
} from "../src/utils/errors.ts";

test("AppError subclasses carry their error code", () => {
  assert.equal(new AuthenticationRequiredError().code, "AUTH_REQUIRED");
  assert.equal(new ChallengeRequiredError().code, "CHALLENGE_REQUIRED");
  assert.equal(new ListingNotFoundError().code, "LISTING_NOT_FOUND");
  assert.equal(new RateLimitError().code, "RATE_LIMITED");
});

test("toMcpError maps known errors to safe payloads", () => {
  const payload = toMcpError(new AuthenticationRequiredError());
  assert.equal(payload.error, "AUTH_REQUIRED");
  assert.match(payload.message, /login is required/i);
});

test("toMcpError hides unknown errors behind INTERNAL_ERROR", () => {
  const payload = toMcpError(new Error("playwright stacktrace: secret path"));
  assert.equal(payload.error, "INTERNAL_ERROR");
  assert.doesNotMatch(payload.message, /secret path/);
});
