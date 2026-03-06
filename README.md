# x-research-skill

X/Twitter research skill with a TypeScript CLI for searching tweets, reading threads, monitoring account watchlists, and returning structured, cache-backed findings for agent workflows.

## What this repo is

This repository contains:

- A skill spec in `SKILL.md` that tells an agent when and how to use X data for research.
- A CLI in `scripts/x-search.ts` that wraps common X API v2 workflows.
- Support libraries for API calls, caching, formatting, and dry-run mock data.

## Who this is for

- **Users** who want quick, repeatable X/Twitter research from the terminal.
- **Agents** that need structured social-signal data (JSON) they can summarize, rank, and cite.

## Platform Compatibility

| Platform | Status | Notes |
|----------|--------|-------|
| **OpenClaw** | ✅ Full support | Set `X_BEARER_TOKEN` env var or place `.env.x-api` in skill directory |
| **Codex (OpenAI)** | ✅ Works | Add `api.x.com` to domain allowlist. Set `X_BEARER_TOKEN` via environment secrets |
| **Claude Cowork** | ❌ Currently blocked | Cowork's MITM proxy blocks custom domain egress regardless of admin allowlist ([#23818](https://github.com/anthropics/claude-code/issues/23818), [#30112](https://github.com/anthropics/claude-code/issues/30112)). Will work once Anthropic fixes their proxy |

## Quick start

### 1) Run in dry-run mode (no API token required)

```bash
npx tsx scripts/x-search.ts search "AI agents replacing junior developers" --dry-run
```

Dry-run uses mock data from `scripts/lib/mock.ts` so you can test end-to-end behavior safely.

### 2) Configure live X API access

**Option A — environment variable (recommended, works everywhere):**

```bash
export X_BEARER_TOKEN=your_token_here
npx tsx scripts/x-search.ts search "query"
```

**Option B — env file in skill directory (OpenClaw default):**

Create `.env.x-api` in the skill directory:

```bash
echo "X_BEARER_TOKEN=your_token_here" > .env.x-api
```

The CLI checks `X_BEARER_TOKEN` env var first, then falls back to the file.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `X_BEARER_TOKEN` | *(required)* | X API v2 Bearer Token — checked before any file |
| `X_ENV_FILE` | `{skill-dir}/.env.x-api` | Override path to the token env file |
| `X_CONFIG_FILE` | `{skill-dir}/config.json` | Override path to the config/watchlist file |
| `X_CACHE_DIR` | `~/.x-research-cache` | Override path to the local cache directory |

## CLI commands

Run from repository root:

```bash
npx tsx scripts/x-search.ts <command> ...
```

### Search

```bash
npx tsx scripts/x-search.ts search "your query" --max-results 50 --sort relevancy
```

### Read a specific tweet or thread from URL/ID

```bash
npx tsx scripts/x-search.ts read "https://x.com/user/status/1234567890"
npx tsx scripts/x-search.ts read 1234567890
```

### Expand a thread by tweet ID

```bash
npx tsx scripts/x-search.ts thread 1234567890
```

### Get a user timeline

```bash
npx tsx scripts/x-search.ts timeline someuser --max-results 20
```

### Watchlist

```bash
npx tsx scripts/x-search.ts watchlist
npx tsx scripts/x-search.ts watchlist-add someuser --reason "Tracks industry shifts"
npx tsx scripts/x-search.ts watchlist-remove someuser
```

### Dry-run flag (works with read/search/thread/timeline/watchlist)

```bash
--dry-run
```

## Agent usage notes

If you are wiring this into an agent workflow:

1. Read `SKILL.md` first for trigger conditions and research methodology.
2. Execute `scripts/x-search.ts` commands with `npx tsx`.
3. Parse stdout as JSON and then post-process/summarize.
4. Include tweet URLs in outputs so claims are traceable.

### Recommended agent flow

1. Decompose the user question into multiple search angles.
2. Run multiple `search` calls.
3. Expand high-signal results via `thread`/`read`.
4. Use `engagement_ratio`, recency, and content quality to filter.
5. Return both curated findings and raw tweets.

## Configuration and storage

The CLI auto-creates config/cache directories as needed.

- Token: `X_BEARER_TOKEN` env var (preferred), or `.env.x-api` in skill directory (override with `X_ENV_FILE`)
- Config: `{skill-dir}/config.json` (override with `X_CONFIG_FILE`)
- Cache base: `~/.x-research-cache/` (override with `X_CACHE_DIR`)
  - Search cache: `search/` (24h TTL)
  - Thread cache: `threads/` (24h TTL)
  - User cache: `users/` (1h TTL)

## Project structure

```text
.
├── SKILL.md
├── README.md
├── scripts/
│   ├── x-search.ts
│   └── lib/
│       ├── api.ts
│       ├── cache.ts
│       ├── format.ts
│       └── mock.ts
├── references/
│   └── x-api.md
└── evals/
    └── eval_metadata.json
```

## Troubleshooting

- **Missing token**: set `X_BEARER_TOKEN` env var, or create `.env.x-api` in the skill directory with `X_BEARER_TOKEN=...`.
- **401 Unauthorized**: token is invalid or revoked.
- **429 rate limit**: CLI includes retry/backoff; wait and retry.
- **Noisy results**: tighten query with operators (see `references/x-api.md`).
- **Old threads returning empty**: threads older than 7 days fall outside the `search/recent` window. The CLI automatically falls back to the author's timeline. Check the `source` and `complete` fields in the response — `"timeline_fallback"` with `complete: false` means the thread may be partial.

## Notes

- No build step is required for basic use.
- This repo is script-first and intended to be run locally.
