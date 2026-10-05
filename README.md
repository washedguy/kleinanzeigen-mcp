# kleinanzeigen-mcp

> **Unofficial project.** Not affiliated with, endorsed by, or connected to
> Kleinanzeigen. "Kleinanzeigen" is used only to describe what the software
> talks to. This software performs **user-directed** browser automation on
> publicly available listings — no account, no login.

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server for
public [kleinanzeigen.de](https://www.kleinanzeigen.de) listings. It lets an AI
agent search listings and read a single listing through a local browser session.

No AI, no chat UI, no cloud service, no login, no messaging.

## Acceptable use

The tool reads public listings, one request at a time, on behalf of a single
person. It deliberately does **not**:

- log in, create accounts, or touch any account,
- read inboxes, send messages, or manage saved searches,
- solve or bypass CAPTCHAs, challenges or access controls,
- rotate proxies or spoof fingerprints to evade blocks,
- crawl or bulk-export listings.

Every action maps to one user request: one search, one listing. Searches are
capped at 10 result pages. You are responsible for complying with the terms of
service of any site you access through this software.

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

| Tool | Input | Returns |
| --- | --- | --- |
| `search_listings` | `query`, `location?`, `radiusKm?`, `minPrice?`, `maxPrice?`, `sort?`, `maxPages?` | `{ results }` |
| `get_listing` | `id?` or `url?` | `Listing` |

`sort` is `relevance` (default), `newest`, `price_asc` or `price_desc`.
`location` takes a city or postal code and combines with `radiusKm`. `maxPages`
(1–10) walks the numbered result pages and de-duplicates by listing id. Note that
promoted "Top-Anzeigen" are pinned to the top and ignore sorting.

### Errors

Failures come back as small, safe payloads — never browser stack traces:

```json
{ "error": "CHALLENGE_REQUIRED", "message": "Kleinanzeigen presented a challenge (e.g. CAPTCHA). Try again later from a normal browser session." }
```

Codes: `CHALLENGE_REQUIRED`, `NAVIGATION_ERROR`, `LISTING_NOT_FOUND`,
`RATE_LIMITED`, `INVALID_INPUT`, `INTERNAL_ERROR`.

## Examples

```ts
const { results } = await searchListings({ query: "Mac Mini M4", maxPrice: 500, sort: "price_asc" });
const listing = await getListing({ id: results[0].id });
```

## How it works

MCP and browser automation are strictly separated: the MCP layer only validates
inputs and formats outputs, and never touches the browser.

```text
src/
├── index.ts                 # stdio entrypoint
├── mcp/                     # tools, schemas, response shape
├── kleinanzeigen/           # browser session, page readers, parsing, domain models
└── types/  utils/
```

Search results and listings are parsed from Kleinanzeigen's server-rendered HTML
into domain models; raw HTML never reaches the MCP client.

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

Snapshots may contain public listing data and are git-ignored — do not commit
them.

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

- No login, credentials, cookies or tokens: the server only reads public pages.
- Sessions are not persisted.
- Challenges are never solved or bypassed: the server returns
  `CHALLENGE_REQUIRED`.
- No proxy rotation, no account creation, no CAPTCHA solving, no bulk scraping.
- Logs go to stderr only (stdout is the MCP transport).

## Limitations

- **Read-only, public listings.** No account features.
- **IP reputation is out of scope.** If Kleinanzeigen temporarily blocks your IP
  range, wait it out and reduce request frequency.
- Promoted listings appear above the requested sort order.
