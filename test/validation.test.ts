import assert from "node:assert/strict";
import { test } from "node:test";
import { getListing, searchListings } from "../src/kleinanzeigen/index.ts";
import { InvalidInputError } from "../src/utils/errors.ts";

// Validation runs before the browser is touched, so no Chromium is needed.

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
