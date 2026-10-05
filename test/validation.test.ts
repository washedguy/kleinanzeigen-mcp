import assert from "node:assert/strict";
import { test } from "node:test";
import { getListing, searchListings, sendMessage } from "../src/kleinanzeigen/index.ts";
import { InvalidInputError } from "../src/utils/errors.ts";

// These validations run before the browser is touched, so no Chromium is needed.

test("searchListings rejects an empty query", async () => {
  await assert.rejects(() => searchListings({ query: "   " }), InvalidInputError);
});

test("searchListings rejects minPrice greater than maxPrice", async () => {
  await assert.rejects(
    () => searchListings({ query: "mac", minPrice: 500, maxPrice: 100 }),
    InvalidInputError,
  );
});

test("getListing requires an id or url", async () => {
  await assert.rejects(() => getListing({}), InvalidInputError);
});

test("sendMessage requires a non-empty message", async () => {
  await assert.rejects(
    () => sendMessage({ conversationId: "x", message: "  " }),
    InvalidInputError,
  );
});

test("sendMessage requires exactly one target", async () => {
  await assert.rejects(() => sendMessage({ message: "hi" }), InvalidInputError);
  await assert.rejects(
    () => sendMessage({ conversationId: "x", listingId: "y", message: "hi" }),
    InvalidInputError,
  );
});
