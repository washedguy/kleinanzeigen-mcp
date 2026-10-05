import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conversationIdFromUrl,
  type MessageboxConversationDetail,
  type MessageboxConversationListItem,
  mapConversation,
  mapConversationSummary,
  mapMessages,
} from "../src/kleinanzeigen/messages.ts";

// Synthetic messagebox API data (same shape the server maps in production).
const listItem: MessageboxConversationListItem = {
  id: "conv-1001",
  adId: "1000000001",
  adTitle: "Beispiel Laptop",
  role: "Buyer",
  buyerName: "Max Mustermann",
  sellerName: "Erika Beispiel",
  unread: false,
  receivedDate: "2026-10-05T12:00:00.000Z",
  unichatLatestMessage: {
    authorId: "20000002",
    payload: { type: "chat/text-message", content: { text: "650€" } },
  },
};

const detail: MessageboxConversationDetail = {
  id: "conv-1001",
  role: "Buyer",
  buyerName: "Max Mustermann",
  sellerName: "Erika Beispiel",
  adId: "1000000001",
  adTitle: "Beispiel Laptop",
  adPriceInEuroCent: 69900,
  messages: [
    {
      messageId: "message-001",
      boundness: "OUTBOUND",
      receivedDate: "2026-10-05T12:00:00.000Z",
      unichatMessage: { authorId: "10000001", payload: { content: { text: "Noch verfügbar?" } } },
    },
    {
      messageId: "message-002",
      boundness: "INBOUND",
      receivedDate: "2026-10-05T12:05:00.000Z",
      textShort: "Ja, noch da.",
      unichatMessage: { authorId: "20000002", payload: { content: { text: "Ja, noch da." } } },
    },
  ],
};

test("mapConversationSummary maps the conversations API shape", () => {
  const summary = mapConversationSummary(listItem);
  assert.equal(summary.id, "conv-1001");
  assert.equal(summary.listingId, "1000000001");
  assert.equal(summary.listingTitle, "Beispiel Laptop");
  assert.equal(summary.otherParty, "Erika Beispiel");
  assert.equal(summary.lastMessage, "650€");
  assert.equal(summary.lastMessageAt, "2026-10-05T12:00:00.000Z");
  assert.equal(summary.unread, undefined);
});

test("mapMessages maps boundness to sender and extracts text", () => {
  const messages = mapMessages(detail.messages ?? []);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].sender, "me");
  assert.equal(messages[0].text, "Noch verfügbar?");
  assert.equal(messages[0].id, "message-001");
  assert.equal(messages[1].sender, "other");
  assert.equal(messages[1].text, "Ja, noch da.");
  assert.equal(messages[1].timestamp, "2026-10-05T12:05:00.000Z");
});

test("mapConversation maps listing metadata and messages", () => {
  const conversation = mapConversation(detail);
  assert.equal(conversation.id, "conv-1001");
  assert.equal(conversation.otherParty, "Erika Beispiel");
  assert.equal(conversation.listing?.id, "1000000001");
  assert.equal(conversation.listing?.title, "Beispiel Laptop");
  assert.equal(conversation.listing?.price, 699);
  assert.equal(conversation.listing?.url, "https://www.kleinanzeigen.de/zur-anzeige/1000000001");
  assert.equal(conversation.messages.length, 2);
});

test("conversationIdFromUrl reads the query parameter", () => {
  assert.equal(
    conversationIdFromUrl(
      "https://www.kleinanzeigen.de/m-nachrichten.html?conversationId=abc%3Adef",
    ),
    "abc:def",
  );
  assert.equal(conversationIdFromUrl("https://www.kleinanzeigen.de/m-nachrichten.html"), undefined);
});
