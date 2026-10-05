import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchResults } from "../src/kleinanzeigen/search.ts";

// Minimal synthetic markup: only the hooks the parser relies on.
const HTML = `
<article data-adid="1000000001" data-href="/s-anzeige/gesuch/1000000001-1-2">
  <img data-imgsrc="https://img.example.com/a1?rule=$_59.AUTO">
  <span>12345 Musterstadt</span>
  <h3><a href="/s-anzeige/gesuch/1000000001-1-2">Gesuch Beispielartikel</a></h3>
  <p class="my-xsmall text-title3 font-strong text-secondary"> VB</p>
</article>
<article data-adid="1000000002" data-href="/s-anzeige/laptop/1000000002-2-3">
  <img data-imgsrc="https://img.example.com/a2?rule=$_59.AUTO">
  <span>54321 Beispielstadt</span><span>Heute, 12:00</span>
  <h3><a href="/s-anzeige/laptop/1000000002-2-3">Beispiel Laptop</a></h3>
  <p class="my-xsmall text-title3 font-strong text-secondary">929 €</p>
</article>
<article data-adid="1000000003" data-href="/s-anzeige/kamera/1000000003-3-4">
  <img data-imgsrc="https://img.example.com/a3?rule=$_59.AUTO">
  <span>98765 Testingen</span><span>05.10.2026</span>
  <h3><a href="/s-anzeige/kamera/1000000003-3-4">Beispielkamera</a></h3>
  <p class="my-xsmall text-title3 font-strong text-secondary">500 € VB</p>
</article>
`;

test("parseSearchResults extracts normalized summaries", () => {
  const results = parseSearchResults(HTML);
  assert.equal(results.length, 3);

  const first = results[0];
  assert.equal(first.id, "1000000001");
  assert.equal(first.title, "Gesuch Beispielartikel");
  assert.equal(first.url, "https://www.kleinanzeigen.de/s-anzeige/gesuch/1000000001-1-2");
  assert.equal(first.imageUrl, "https://img.example.com/a1?rule=$_59.AUTO");
  assert.equal(first.location, "12345 Musterstadt");
});

test("parseSearchResults maps prices and relative dates", () => {
  const results = parseSearchResults(HTML);
  const priced = results.find((r) => r.id === "1000000002");
  assert.ok(priced);
  assert.equal(priced.price, 929);
  assert.equal(priced.location, "54321 Beispielstadt");
  assert.ok(!Number.isNaN(Date.parse(priced.createdAt ?? "")));
});

test("parseSearchResults maps negotiable-only prices to null", () => {
  const results = parseSearchResults(HTML);
  const vb = results.find((r) => r.title.includes("Gesuch"));
  assert.ok(vb);
  assert.equal(vb.price, null);
});

test("parseSearchResults returns an empty array for unrelated HTML", () => {
  assert.deepEqual(parseSearchResults("<html><body>nope</body></html>"), []);
});
