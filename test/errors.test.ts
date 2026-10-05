import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ChallengeRequiredError,
  ListingNotFoundError,
  RateLimitError,
  toMcpError,
} from "../src/utils/errors.ts";

test("AppError subclasses carry their error code", () => {
  assert.equal(new ChallengeRequiredError().code, "CHALLENGE_REQUIRED");
  assert.equal(new ListingNotFoundError().code, "LISTING_NOT_FOUND");
  assert.equal(new RateLimitError().code, "RATE_LIMITED");
});

test("toMcpError maps known errors to safe payloads", () => {
  const payload = toMcpError(new ChallengeRequiredError());
  assert.equal(payload.error, "CHALLENGE_REQUIRED");
  assert.match(payload.message, /challenge/i);
});

test("toMcpError hides unknown errors behind INTERNAL_ERROR", () => {
  const payload = toMcpError(new Error("playwright stacktrace: secret path"));
  assert.equal(payload.error, "INTERNAL_ERROR");
  assert.doesNotMatch(payload.message, /secret path/);
});
