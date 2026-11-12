# kleinanzeigen-mcp

MCP server for searching and reading Kleinanzeigen listings.

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

The server uses [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright). Set `KLEINANZEIGEN_CHANNEL=chrome|msedge|bundled` to select a browser.

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

## Notes

- Searches return up to 10 pages; promoted listings can appear above the requested sort order.
- Challenges return `CHALLENGE_REQUIRED`; try again later.
- This is an unofficial integration and site behavior may change.

## Author

Built by Jan Herklotz at [washed.dev](https://washed.dev) — websites and web apps from Wiesbaden. Have a project in mind? [Get in touch](mailto:hello@washed.dev).

## License

[MIT](LICENSE)
