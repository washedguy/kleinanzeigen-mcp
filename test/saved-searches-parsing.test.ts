import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeSavedSearchRecords,
  parseSavedSearches,
} from "../src/kleinanzeigen/saved-searches.ts";
import {
  nextPageUrl,
  pageNumberFromUrl,
  parsePaginationLinks,
} from "../src/kleinanzeigen/search.ts";

const SAVED_HTML = `
<ul id="my-savedsearches-list" class="itemlist">
  <li class="savedsearch-listitem" data-saved-search="900000001">
    <h2 class="text-module-begin">
      <a href="/m-suche-verwenden.html?id=900000001">Beispiel Suche in Musterstadt</a>
    </h2>
    <label class="saved-searches-badge">neu</label>
    <div>05.10.2026</div>
  </li>
  <li class="savedsearch-listitem" data-saved-search="900000002">
    <h2 class="text-module-begin">
      <a href="/m-suche-verwenden.html?id=900000002">Alle Kategorien - Beispielartikel</a>
    </h2>
    <div>04.10.2026</div>
  </li>
  <li class="savedsearch-listitem" data-saved-search="900000003">
    <h2 class="text-module-begin">
      <a href="/m-suche-verwenden.html?id=900000003">Beispiel Dienstleistung</a>
    </h2>
    <div>03.10.2026</div>
  </li>
</ul>
`;

const PAGINATION_HTML = `
<div id="pagination-container">
  <span>1</span>
  <a href="/s-seite:2/beispiel-suche/k0" aria-label="Seite 2">2</a>
  <a href="/s-seite:3/beispiel-suche/k0" aria-label="Seite 3">3</a>
  <a href="/s-seite:4/beispiel-suche/k0" aria-label="Seite 4">4</a>
  <a href="/s-seite:5/beispiel-suche/k0" aria-label="Seite 5">5</a>
</div>
`;

test("parseSavedSearches extracts id, name and url", () => {
  const saved = parseSavedSearches(SAVED_HTML);
  assert.equal(saved.length, 3);
  assert.equal(saved[0].id, "900000001");
  assert.equal(saved[0].name, "Beispiel Suche in Musterstadt");
  assert.equal(saved[0].url, "https://www.kleinanzeigen.de/m-suche-verwenden.html?id=900000001");
  assert.equal(saved[0].isNew, true);
  assert.ok(saved.every((s) => /^\d+$/.test(s.id)));
});

test("parsePaginationLinks finds numbered page links", () => {
  const links = parsePaginationLinks(PAGINATION_HTML);
  assert.deepEqual(
    links.map((l) => l.page).sort((a, b) => a - b),
    [2, 3, 4, 5],
  );
  assert.match(links[0].href, /^\/s-seite:\d+\//);
});

test("nextPageUrl returns the absolute next page", () => {
  assert.equal(
    nextPageUrl(PAGINATION_HTML, 1),
    "https://www.kleinanzeigen.de/s-seite:2/beispiel-suche/k0",
  );
  assert.equal(nextPageUrl(PAGINATION_HTML, 5), undefined);
});

test("pageNumberFromUrl reads the seite segment", () => {
  assert.equal(pageNumberFromUrl("https://www.kleinanzeigen.de/s-seite:3/beispiel-suche/k0"), 3);
  assert.equal(pageNumberFromUrl("https://www.kleinanzeigen.de/s-beispiel-suche/k0"), undefined);
});

test("normalizeSavedSearchRecords de-duplicates ids and merges names", () => {
  const normalized = normalizeSavedSearchRecords([
    { id: "111", isNew: true },
    { id: "111", name: "Beispiel Suche" },
    { id: "222", name: "Zweite Suche" },
    { id: "not-a-number" },
  ]);
  assert.equal(normalized.length, 2);
  const first = normalized.find((s) => s.id === "111");
  assert.equal(first?.name, "Beispiel Suche");
  assert.equal(first?.isNew, true);
  assert.equal(first?.url, "https://www.kleinanzeigen.de/m-suche-verwenden.html?id=111");
});
