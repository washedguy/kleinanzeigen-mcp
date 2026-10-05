import assert from "node:assert/strict";
import { test } from "node:test";
import { parseListing } from "../src/kleinanzeigen/listing.ts";
import { ListingNotFoundError } from "../src/utils/errors.ts";

const HTML = `
<h1 id="viewad-title" class="boxedarticle--title" itemprop="name">Beispiel Laptop</h1>
<h2 class="boxedarticle--price" id="viewad-price">500 € VB</h2>
<span id="viewad-locality" itemprop="addressLocality">12345 Beispielstadt</span>
<div id="viewad-extra-info"><div><span>05.10.2026</span></div></div>
<p id="viewad-description-text" itemprop="description">Beispielbeschreibung<br />Zweite Zeile</p>
<img data-imgsrc="https://img.example.com/a1?rule=$_59.AUTO">
<img data-imgsrc="https://img.example.com/a2?rule=$_59.AUTO">
<img data-imgsrc="https://img.example.com/a3?rule=$_59.AUTO">
<script>
  window.trxVipSection = { contactName: "Max Mustermann", sellerType: "private", isCommercialUser: false };
</script>
`;

const URL_ = "https://www.kleinanzeigen.de/s-anzeige/beispiel-laptop/1000000001-1-2";

test("parseListing extracts normalized listing data", () => {
  const listing = parseListing(HTML, URL_);

  assert.equal(listing.id, "1000000001");
  assert.equal(listing.url, URL_);
  assert.equal(listing.title, "Beispiel Laptop");
  assert.equal(listing.price, 500);
  assert.equal(listing.negotiable, true);
  assert.equal(listing.location, "12345 Beispielstadt");
  assert.match(listing.description, /Beispielbeschreibung/);
  assert.equal(listing.images.length, 3);
  assert.ok(listing.images.every((img) => img.startsWith("https://img.example.com/")));
  assert.equal(listing.seller?.name, "Max Mustermann");
  assert.equal(listing.seller?.type, "private");
});

test("parseListing throws ListingNotFoundError for missing listings", () => {
  const removed = "<html><body><h1>Diese Anzeige gibt es nicht mehr.</h1></body></html>";
  assert.throws(() => parseListing(removed, URL_), ListingNotFoundError);
});
