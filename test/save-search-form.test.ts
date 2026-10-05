import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deserializeAstroProps,
  serializeSearchFormParams,
} from "../src/kleinanzeigen/saved-searches.ts";

// Minimal Astro island props in the `[type, payload]` encoding the app uses.
const PROPS: Record<string, unknown> = {
  csrfToken: [0, "00000000-0000-0000-0000-000000000000"],
  savedSearchesSubscribeModel: [
    0,
    {
      createUrl: [0, "/m-suche-abonnieren.json"],
      deleteUrl: [0, "/m-suche-loeschen.json"],
    },
  ],
  searchFormParams: [
    0,
    {
      keywords: [0, "beispiel suchbegriff"],
      categoryId: [0],
      radius: [0, 0],
      sortingField: [0, "SORTING_DATE"],
      pageNum: [0, "1"],
      action: [0, "find"],
      buyNowEnabled: [0, false],
      clickableOptions: [1, []],
    },
  ],
};

test("deserializeAstroProps unwraps the island serialization", () => {
  const decoded = deserializeAstroProps(PROPS) as Record<string, unknown>;
  assert.equal(decoded.csrfToken, "00000000-0000-0000-0000-000000000000");

  const model = decoded.savedSearchesSubscribeModel as Record<string, unknown>;
  assert.equal(model.createUrl, "/m-suche-abonnieren.json");
  assert.equal(model.deleteUrl, "/m-suche-loeschen.json");

  const params = decoded.searchFormParams as Record<string, unknown>;
  assert.equal(params.keywords, "beispiel suchbegriff");
  assert.equal(params.sortingField, "SORTING_DATE");
  assert.equal(params.buyNowEnabled, false);
  assert.deepEqual(params.clickableOptions, []);
});

test("serializeSearchFormParams matches the web app (skips empty values)", () => {
  const decoded = deserializeAstroProps(PROPS) as Record<string, unknown>;
  const body = serializeSearchFormParams(decoded.searchFormParams as Record<string, unknown>);
  const parsed = new URLSearchParams(body);

  assert.equal(parsed.get("keywords"), "beispiel suchbegriff");
  assert.equal(parsed.get("sortingField"), "SORTING_DATE");
  assert.equal(parsed.get("action"), "find");
  assert.equal(parsed.get("pageNum"), "1");
  assert.equal(parsed.get("buyNowEnabled"), "false");
  assert.equal(parsed.get("categoryId"), null);
  assert.equal(parsed.get("clickableOptions"), null);
});
