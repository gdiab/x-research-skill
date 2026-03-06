---
name: x-research
description: >
  X/Twitter research skill for searching tweets, monitoring accounts, and gathering
  public discourse on any topic. Use this skill whenever the user asks to research
  what people are saying on X/Twitter, find tweets about a topic, monitor X accounts,
  gather supporting or opposing viewpoints from X, do market/industry research using
  Twitter data, or investigate public sentiment. Also trigger when the user mentions
  "X search", "Twitter search", "tweets about", "what's the discourse on", "what are
  people saying about", or wants to find takes/opinions/threads on any subject —
  even if they don't explicitly say "X" or "Twitter". If the task involves pulling
  signal from public social conversation, this is the skill to use. Do NOT use for
  general web searches, non-X social platforms, or private/DM content.
compatibility: >
  Requires Node.js 18+ with npx/tsx and outbound HTTPS access to api.x.com. Uses the X API v2 (Basic tier).
metadata: {"author":"gdiab","version":"1.2.0","openclaw":{"requires":{"bins":["node"],"env":["X_BEARER_TOKEN"]}}}
---

# X Research Skill

## Platform Compatibility

- **OpenClaw**: Full support. Set `X_BEARER_TOKEN` env var or place `.env.x-api` in the skill directory.
- **Codex (OpenAI)**: Works. Add `api.x.com` to the environment's domain allowlist. Set `X_BEARER_TOKEN` via environment secrets.
- **Claude Cowork**: Currently blocked. Cowork's MITM proxy blocks custom domain egress regardless of admin allowlist settings (anthropics/claude-code#23818, #30112). Will work once Anthropic fixes their proxy.

You are an X/Twitter research module. Your job is to help the user gather signal
from public discourse on X — finding relevant tweets, threads, and accounts on any topic.
The goal is structured, actionable intelligence: not a wall of raw tweets, but curated
findings that surface what matters.

## Architecture

The skill has three components:

1. **Search** (primary) — Query the X API v2 to find tweets matching a research question
2. **Watchlist** (secondary) — Monitor a set of accounts for recent activity
3. **Cache** — Avoid redundant API calls with local caching (24h TTL for searches, 1h for timelines)

### File locations

| What | Where |
|------|-------|
| API token | `X_BEARER_TOKEN` env var (preferred), or `.env.x-api` in skill dir (override via `X_ENV_FILE`) |
| Config | `{baseDir}/config.json` (override via `X_CONFIG_FILE`) |
| Search cache | `~/.x-research-cache/search/` (override via `X_CACHE_DIR`) |
| Thread cache | `~/.x-research-cache/threads/` |
| User cache | `~/.x-research-cache/users/` |

## Research Methodology

When given a research question, the user may optionally specify a research lens:
- `balanced` (default) — seek equal coverage of supporting, opposing, and neutral viewpoints
- `supporting` — weight toward arguments in favor, but still include counterpoints
- `opposing` — weight toward critical/skeptical takes, but still include the best supporting arguments

If no lens is specified, default to balanced. The lens affects how many search angles you
allocate to each perspective, not whether you include them — always include at least one
search for the other side.

### 1. Decompose the question into search angles

Most research questions benefit from multiple searches rather than one broad query.
Think about the topic from different angles:

- **Direct mentions** — the thing itself (e.g., `"product name"`)
- **Adjacent discussions** — related concepts people might discuss instead
- **Supporting viewpoints** — people who agree or are enthusiastic
- **Opposing viewpoints** — critics, skeptics, contrarians
- **Expert voices** — known authorities or practitioners in the space
- **Institutional data** — for workforce, market, or industry questions, specifically
  search for data points: hiring reports, survey results with sample sizes, company
  announcements, layoff/expansion reports. Individual opinions are easy to find; hard
  data from employers, analysts, or researchers is rarer and more valuable.

For content research specifically (e.g., "I'm writing a post about X, find me viewpoints"),
deliberately seek out the tension. The most useful research surfaces disagreement, not just
consensus.

**Example decomposition:**
> "Research what people think about AI coding assistants"
>
> Search 1: `"AI coding assistant" OR "AI pair programmer" -is:retweet lang:en` (direct takes)
> Search 2: `"copilot" OR "cursor" OR "claude code" productivity -is:retweet` (specific tools)
> Search 3: `"AI coding" (overrated OR overhyped OR "doesn't work") -is:retweet` (skeptics)
> Search 4: `"AI coding" (amazing OR "game changer" OR "10x") -is:retweet` (enthusiasts)
> Search 5: `"AI coding" (survey OR "hired" OR "layoff" OR data OR report) -is:retweet` (institutional data)

### 2. Execute searches

Use the `scripts/x-search.ts` CLI tool for each query. The tool handles authentication,
caching, pagination, and rate limiting automatically.

```bash
# Basic search
npx tsx {baseDir}/scripts/x-search.ts search "your query here"

# Search with options
npx tsx {baseDir}/scripts/x-search.ts search "query" --max-results 50 --sort recency

# Read a specific tweet or thread from a URL
npx tsx {baseDir}/scripts/x-search.ts read "https://x.com/user/status/123456"

# Also works with just a tweet ID
npx tsx {baseDir}/scripts/x-search.ts read 123456

# Get a specific thread by conversation ID
npx tsx {baseDir}/scripts/x-search.ts thread <tweet-id>

# Check watchlist
npx tsx {baseDir}/scripts/x-search.ts watchlist

# Add to watchlist
npx tsx {baseDir}/scripts/x-search.ts watchlist-add <username> --reason "why monitoring"

# Get user timeline
npx tsx {baseDir}/scripts/x-search.ts timeline <username> --max-results 20
```

The `read` command is the easiest way to fetch a specific post the user shares. It accepts
a full X/Twitter URL (e.g., `https://x.com/user/status/123456`) or a bare tweet ID, extracts
the ID, fetches the tweet and its full thread if it's part of one, and returns structured JSON.
Use this whenever the user pastes an X link and asks you to read, summarize, or analyze it.

The tool returns structured JSON to stdout. Parse it and work with the data directly.

### 3. Expand threads

After gathering search results, check the `conversation_id` field on each tweet. If a
tweet's `conversation_id` differs from its own `id`, it's part of a thread. Interesting
tweets that are part of threads should be expanded — a single tweet from a 12-tweet thread
can be misleading out of context. Use the `thread` command to pull the full conversation.

Prioritize thread expansion for:
- Tweets that start with "Thread:" or "🧵" or have a high reply count from the same author
- High-engagement tweets where the single-tweet text feels incomplete or like an intro
- Any tweet you plan to feature as a key finding

Don't expand every thread — that would be wasteful on API calls. Use judgment about which
threads are worth the extra fetch.

**Thread retrieval details:** The `thread` command first tries `search/recent` (covers
the last 7 days). If the thread is older, it automatically falls back to the author's
timeline and filters by `conversation_id`. The response includes metadata:
- `source`: `"search"` or `"timeline_fallback"` — how the thread was retrieved
- `complete`: `true` if via search (comprehensive), `false` if via timeline fallback
  (may be incomplete since the timeline only returns the author's most recent tweets)

When `complete` is `false`, note this in your output so the user knows the thread may
be partial.

### 4. Filter, rank, and classify results

Raw search results contain noise. After gathering tweets:

**Filter by quality:**
- **Engagement ratio** — the tool's `engagement_score` field normalizes engagement by
  follower count. A 3,200-like tweet from a 3,200-follower account (ratio ~1000) is a
  far stronger signal than 1,890 likes from a 430K-follower account (ratio ~4). Use the
  ratio, not raw counts, to identify tweets that genuinely resonated.
- **Substantive content** — skip one-word reactions, pure self-promotion, and spam.
  Look for tweets that contain reasoning, evidence, or novel perspectives.
- **Recency** — weight recent tweets higher. A take from last week is more relevant than
  one from 6 months ago for most research. Include the `posted_at` date prominently in
  findings so the user can judge temporal relevance themselves.

**Classify by conclusion, not search angle:**
This is important. A tweet found via the "supporting" search might actually contain an
opposing argument (e.g., someone who tried replacing juniors with AI and found it failed —
that's an opposing conclusion even if the search was for "AI agents" + "productivity").
Read each tweet and classify based on what the author actually concludes, not which search
bucket it came from. Categories:
- `supporting` — argues in favor of the thesis
- `opposing` — argues against the thesis
- `neutral` — presents data or analysis without a clear stance
- `expert` — comes from a domain practitioner (check their bio)
- `data` — contains quantitative evidence, surveys, or institutional findings

**Cluster by distinct argument:**
Many tweets restate the same point. After classifying, group findings by the distinct
argument being made. If 12 opposing tweets all say some version of "tools always augment,
never replace," that's one argument with 12 voices, not 12 arguments. In your summary,
report the number of distinct arguments found, not just the raw tweet count. This gives
the user an honest picture of how much intellectual diversity actually exists in the
discourse.

### 5. Structure the output

Return results as JSON. Always include both curated `findings` (your filtered, classified
top results) and a `raw_tweets` array (the unfiltered search results) so the user can
browse beyond your curation.

```json
{
  "query": "the original research question",
  "research_lens": "balanced | supporting | opposing",
  "timestamp": "ISO 8601",
  "searches_executed": [
    {
      "query": "the X search query used",
      "angle": "what this search was looking for",
      "results_count": 47,
      "after_filtering": 12
    }
  ],
  "findings": [
    {
      "tweet_id": "...",
      "author": "@handle",
      "author_followers": 12500,
      "text": "full tweet text",
      "url": "https://x.com/handle/status/...",
      "engagement": {
        "likes": 342,
        "retweets": 89,
        "replies": 56
      },
      "engagement_ratio": 82.4,
      "posted_at": "ISO 8601",
      "recency": "2 days ago",
      "classification": "supporting | opposing | neutral | expert | data",
      "distinct_argument": "short label for the argument cluster this belongs to",
      "is_thread": false,
      "thread_id": "if part of a thread, the root tweet ID",
      "key_point": "one-sentence summary of why this tweet matters"
    }
  ],
  "raw_tweets": [],
  "summary": {
    "total_results_scanned": 200,
    "total_findings": 15,
    "classification_breakdown": {
      "supporting": 8,
      "opposing": 4,
      "neutral": 2,
      "data": 1
    },
    "distinct_arguments": {
      "supporting": ["argument label 1", "argument label 2"],
      "opposing": ["argument label 3", "argument label 4"]
    },
    "key_themes": ["theme 1", "theme 2"],
    "notable_voices": ["@expert1 — context", "@expert2 — context"]
  }
}
```

You decide how to present this to the user based on context. If they're doing casual
research, a conversational summary with links might be best. If they're building content,
the structured JSON with argument clusters is more useful. If they want data to pipe
elsewhere, give them clean JSON.

### 6. Cite everything

Every claim should trace back to a specific tweet URL. When summarizing findings
conversationally, include links so the user can verify and explore further.

## Watchlist

The watchlist is stored in the config file and contains X accounts the user wants to
monitor regularly. Each entry has a username and a reason for monitoring.

When checking the watchlist, fetch recent tweets from each account and highlight anything
notable — new threads, high-engagement posts, topics that match the user's interests.

The config file structure:

```json
{
  "watchlist": [
    {
      "username": "elonmusk",
      "reason": "Platform policy and product changes",
      "added": "2026-01-15"
    }
  ],
  "default_search_params": {
    "max_results": 50,
    "sort": "relevancy",
    "lang": "en",
    "exclude_retweets": true
  }
}
```

## Rate Limits and Costs

The X API v2 has rate limits and per-request costs. The caching layer helps minimize
both, but be mindful:

- **Search endpoint**: 300 requests per 15 minutes (Basic tier), 1 request per tweet returned counts toward monthly quota
- **User timeline**: 900 requests per 15 minutes
- **Thread lookup**: 300 requests per 15 minutes

The cache prevents duplicate API calls:
- Search results are cached for 24 hours (keyed by query hash)
- Thread expansions are cached for 24 hours (keyed by tweet ID)
- User timelines are cached for 1 hour (keyed by username)

If a cached result exists and is still fresh, the tool uses it without hitting the API.

Be strategic with thread expansion — each thread fetch is an additional API call. Only
expand threads that are genuinely worth the cost (high-engagement, from notable authors,
or clearly incomplete as standalone tweets).

## Error Handling

If the API token is missing or invalid, tell the user clearly:
"Your X API token isn't configured. Set the `X_BEARER_TOKEN` environment variable, or add your Bearer Token to `.env.x-api` in the skill directory like: `X_BEARER_TOKEN=your_token_here`"

If rate-limited, wait and retry with exponential backoff (the script handles this
automatically, but let the user know if searches are slow because of throttling).
