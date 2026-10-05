# kleinanzeigen-mcp

> **Unofficial project.** Not affiliated with, endorsed by, or connected to
> Kleinanzeigen. "Kleinanzeigen" is used only to describe what the software
> talks to. This software performs **user-directed** browser automation on the
> user's own account.

A [Model Context Protocol](https://modelcontextprotocol.io) server for
[kleinanzeigen.de](https://www.kleinanzeigen.de). It lets an AI agent search
listings, read a listing, work with saved searches, read the inbox, and send
messages — through the user's **own** account, driven by a local browser.

No AI, no chat UI, no cloud service. Just the MCP server and a local Patchright
browser session.

## Acceptable use

The tool is built for interactive, per-request use by a single person on their
own account. It deliberately does **not**:

- solve or bypass CAPTCHAs, challenges or access controls,
- rotate proxies or spoof fingerprints to evade blocks,
- create accounts,
- crawl or bulk-export listings,
- send bulk or unsolicited messages.

Every action maps to one user request: one search, one listing, one message.
Searches are capped at 10 result pages, and each `send_message` call sends
exactly one message. You are responsible for complying with the terms of service
of any site you access through this software.

## Requirements

- Node.js >= 20

## Install

From npm:

```bash
npm install -g @washedguy/kleinanzeigen-mcp
npx patchright install chromium
```

Or from a checkout:

```bash
npm install
npx patchright install chromium
npm run build
```

The browser runtime is [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright),
a drop-in Playwright fork that closes Playwright's automation leaks
(`Runtime.enable`, `navigator.webdriver`). If a real Google Chrome is installed it
is used automatically for a more realistic fingerprint; override with
`KLEINANZEIGEN_CHANNEL=chrome|msedge|bundled`.

## Login

Credentials are never read or stored. The server keeps a persistent browser
profile at `~/.kleinanzeigen-mcp/browser-profile/`, so a one-time manual login is
reused by all later headless sessions.

```bash
# installed globally
kleinanzeigen-mcp-login
# or from a checkout
npm run login
```

A visible browser opens. Sign in manually — including any SMS code — and the
script detects success and closes. If a challenge or verification appears, solve
it in the browser; the script waits.

> Only one process may use the profile at a time. Stop a running MCP server before
> running the login command, and vice versa.

## Configure the MCP client

The server speaks MCP over **stdio**.

```json
{
  "mcpServers": {
    "kleinanzeigen": {
      "command": "npx",
      "args": ["-y", "@washedguy/kleinanzeigen-mcp"]
    }
  }
}
```

From a checkout, point at the built entrypoint instead:

```json
{
  "mcpServers": {
    "kleinanzeigen": {
      "command": "node",
      "args": ["/path/to/kleinanzeigen-mcp/dist/index.js"]
    }
  }
}
```

## Tools

Read-only:

| Tool | Input | Returns |
| --- | --- | --- |
| `search_listings` | `query`, `location?`, `radiusKm?`, `minPrice?`, `maxPrice?`, `sort?`, `maxPages?` | `{ results }` |
| `get_listing` | `id?` or `url?` | `Listing` |
| `get_conversations` | `limit?` | `{ conversations }` |
| `get_conversation` | `conversationId` | `Conversation` |
| `get_saved_searches` | – | `{ savedSearches }` |
| `run_saved_search` | `id`, `maxPages?` | `{ results }` |

Mutating (clients should require user approval):

| Tool | Input | Returns |
| --- | --- | --- |
| `send_message` | `conversationId?` or `listingId?`, `message` | `{ success, conversationId? }` |
| `save_search` | `query`, `location?`, `radiusKm?`, `minPrice?`, `maxPrice?`, `sort?` | `{ success }` |
| `delete_saved_search` | `id` | `{ success }` |

`sort` is `relevance` (default), `newest`, `price_asc` or `price_desc`.
`location` takes a city or postal code and combines with `radiusKm`. `maxPages`
(1–10) walks the numbered result pages and de-duplicates by listing id. Note that
promoted "Top-Anzeigen" are pinned to the top and ignore sorting.

The server never writes message content: `send_message` sends the exact text it is
given.

### Errors

Failures come back as small, safe payloads — never browser stack traces:

```json
{ "error": "AUTH_REQUIRED", "message": "Kleinanzeigen login is required. Run `npm run login` and sign in." }
```

Codes: `AUTH_REQUIRED`, `CHALLENGE_REQUIRED`, `NAVIGATION_ERROR`,
`LISTING_NOT_FOUND`, `CONVERSATION_NOT_FOUND`, `RATE_LIMITED`, `INVALID_INPUT`,
`INTERNAL_ERROR`.

## Examples

```ts
const { results } = await searchListings({ query: "Mac Mini M4", maxPrice: 500, sort: "price_asc" });
const listing = await getListing({ id: results[0].id });

const { conversations } = await getConversations();
const conversation = await getConversation({ conversationId: conversations[0].id });

await sendMessage({ conversationId: conversation.id, message: "Ja, morgen um 18 Uhr passt." });
```

## How it works

MCP and browser automation are strictly separated: the MCP layer only validates
inputs and formats outputs, and never touches the browser.

```text
src/
├── index.ts                 # stdio entrypoint
├── login.ts                 # npm run login
├── mcp/                     # tools, schemas, response shape
├── kleinanzeigen/           # browser session, page readers, parsing, domain models
└── types/  utils/
```

- **Search & listings** are parsed from Kleinanzeigen's server-rendered HTML into
  domain models. Raw HTML never reaches the MCP client.
- **Inbox & conversations** use the app's own authenticated JSON API
  (`gateway.kleinanzeigen.de/messagebox/api/...`) via the logged-in page, so ids,
  full histories and unread state are exact.
- **Saved searches** read the server-rendered list and use the same subscribe /
  unsubscribe endpoints the web app uses.

## Debugging

```bash
kleinanzeigen-mcp-debug   # or: npm run debug
```

Opens a visible browser and saves every page (and client-side route change) as
HTML plus an `index.jsonl` into `./debug-snapshots/`. To capture from normal tool
calls instead:

```bash
KLEINANZEIGEN_SAVE_HTML=1 npm start
# or: KLEINANZEIGEN_SNAPSHOT_DIR=/tmp/ka-snaps npm run dev
```

Snapshots may contain personal data and are git-ignored — do not commit them.

## Development

```bash
npm run dev        # stdio server with watch mode
npm run verify     # typecheck + lint + tests (run before committing)
npm run check      # Biome lint/format/import-sort (write)
npm run test       # node:test via tsx
```

Linting and formatting use a single dev dependency
([Biome](https://biomejs.dev)); configuration is in `biome.json`.

## Security

- No credentials, cookies, tokens or message bodies are stored or logged.
- The user logs in manually; credentials are never read by this project.
- Challenges are never solved or bypassed: the server returns
  `CHALLENGE_REQUIRED` and the user solves it via `npm run login`.
- No proxy rotation, no automated account creation, no CAPTCHA solving.
- Logs go to stderr only (stdout is the MCP transport).

## Limitations

- **Single user, single profile** — one session at a time.
- **IP reputation is out of scope.** If Kleinanzeigen temporarily blocks your IP
  range, wait it out and reduce request frequency.
- Saved search names are truncated by Kleinanzeigen's own UI.
- No listing creation/editing, payments, bulk messaging or automatic negotiation.
