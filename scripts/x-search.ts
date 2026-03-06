#!/usr/bin/env npx tsx

/**
 * X Research CLI — Thoth's X/Twitter search interface
 *
 * Usage:
 *   npx tsx x-search.ts search "query" [--max-results N] [--sort relevancy|recency] [--dry-run]
 *   npx tsx x-search.ts thread <tweet-id> [--dry-run]
 *   npx tsx x-search.ts timeline <username> [--max-results N] [--dry-run]
 *   npx tsx x-search.ts watchlist [--dry-run]
 *   npx tsx x-search.ts watchlist-add <username> --reason "why"
 *   npx tsx x-search.ts watchlist-remove <username>
 *
 * Flags:
 *   --dry-run    Use mock data instead of hitting the X API (for testing)
 */

import { XApiClient } from "./lib/api.js";
import { CacheManager } from "./lib/cache.js";
import { formatOutput } from "./lib/format.js";
import { mockSearchTweets, mockGetThread, mockGetUserTimeline } from "./lib/mock.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILL_DIR = join(__dirname, ".."); // scripts/ -> x-research/

const PATHS = {
  envFile: process.env.X_ENV_FILE || join(SKILL_DIR, ".env.x-api"),
  config: process.env.X_CONFIG_FILE || join(SKILL_DIR, "config.json"),
  cacheDir: process.env.X_CACHE_DIR || join(process.env.HOME || "~", ".x-research-cache"),
};

function parseArgs(args: string[]): {
  command: string;
  positional: string;
  flags: Record<string, string>;
} {
  const command = args[0] || "help";
  let positional = "";
  const flags: Record<string, string> = {};

  let i = 1;
  while (i < args.length) {
    if (args[i] === "--dry-run") {
      flags["dry-run"] = "true";
      i++;
    } else if (args[i].startsWith("--")) {
      const key = args[i].replace(/^--/, "");
      flags[key] = args[i + 1] || "true";
      i += 2;
    } else if (!positional) {
      positional = args[i];
      i++;
    } else {
      i++;
    }
  }

  return { command, positional, flags };
}

function loadConfig(): any {
  const fs = require("fs");
  const defaultConfig = {
    watchlist: [],
    default_search_params: {
      max_results: 50,
      sort: "relevancy",
      lang: "en",
      exclude_retweets: true,
    },
  };

  try {
    const raw = fs.readFileSync(PATHS.config, "utf-8");
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    // Create default config if it doesn't exist
    const dir = require("path").dirname(PATHS.config);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PATHS.config, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

function saveConfig(config: any): void {
  const fs = require("fs");
  const dir = require("path").dirname(PATHS.config);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PATHS.config, JSON.stringify(config, null, 2));
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const cache = new CacheManager(PATHS.cacheDir);
  const dryRun = flags["dry-run"] === "true";

  // Only create the real API client when we actually need it (not for dry-run or local-only commands)
  const needsApi = ["search", "thread", "timeline", "watchlist", "read"].includes(command) && !dryRun;
  let client: XApiClient | null = null;
  if (needsApi) {
    client = new XApiClient(PATHS.envFile);
  }

  switch (command) {
    case "search": {
      if (!positional) {
        console.error("Usage: x-search.ts search \"query\" [--max-results N] [--sort relevancy|recency] [--dry-run]");
        process.exit(1);
      }

      const maxResults = parseInt(flags["max-results"] || String(config.default_search_params.max_results));
      const sort = flags["sort"] || config.default_search_params.sort;

      if (dryRun) {
        const results = mockSearchTweets(positional, maxResults);
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Check cache first
      const cacheKey = cache.searchKey(positional, { maxResults, sort });
      const cached = cache.get("search", cacheKey);
      if (cached) {
        console.log(JSON.stringify({ ...cached, _cached: true }, null, 2));
        return;
      }

      const results = await client!.searchTweets(positional, {
        maxResults,
        sortOrder: sort as "relevancy" | "recency",
        excludeRetweets: config.default_search_params.exclude_retweets,
      });

      cache.set("search", cacheKey, results, 24 * 60 * 60 * 1000); // 24h TTL
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case "thread": {
      if (!positional) {
        console.error("Usage: x-search.ts thread <tweet-id> [--dry-run]");
        process.exit(1);
      }

      if (dryRun) {
        const thread = mockGetThread(positional);
        console.log(JSON.stringify(thread, null, 2));
        return;
      }

      const cached = cache.get("threads", positional);
      if (cached) {
        console.log(JSON.stringify({ ...cached, _cached: true }, null, 2));
        return;
      }

      const thread = await client!.getThread(positional);
      cache.set("threads", positional, thread, 24 * 60 * 60 * 1000);
      console.log(JSON.stringify(thread, null, 2));
      break;
    }

    case "timeline": {
      if (!positional) {
        console.error("Usage: x-search.ts timeline <username> [--max-results N] [--dry-run]");
        process.exit(1);
      }

      const username = positional.replace(/^@/, "");
      const maxResults = parseInt(flags["max-results"] || "20");

      if (dryRun) {
        const timeline = mockGetUserTimeline(username, maxResults);
        console.log(JSON.stringify(timeline, null, 2));
        return;
      }

      const cached = cache.get("users", `${username}_${maxResults}`);
      if (cached) {
        console.log(JSON.stringify({ ...cached, _cached: true }, null, 2));
        return;
      }

      const timeline = await client!.getUserTimeline(username, maxResults);
      cache.set("users", `${username}_${maxResults}`, timeline, 60 * 60 * 1000); // 1h TTL
      console.log(JSON.stringify(timeline, null, 2));
      break;
    }

    case "watchlist": {
      if (config.watchlist.length === 0) {
        console.log(JSON.stringify({ watchlist: [], message: "Watchlist is empty. Use watchlist-add to add accounts." }));
        return;
      }

      const results = [];
      for (const entry of config.watchlist) {
        try {
          if (dryRun) {
            const timeline = mockGetUserTimeline(entry.username, 10);
            results.push({
              username: entry.username,
              reason: entry.reason,
              recent_tweets: timeline,
            });
            continue;
          }

          const cached = cache.get("users", `${entry.username}_10`);
          let timeline;
          if (cached) {
            timeline = { ...cached, _cached: true };
          } else {
            timeline = await client!.getUserTimeline(entry.username, 10);
            cache.set("users", `${entry.username}_10`, timeline, 60 * 60 * 1000);
            // Rate limit courtesy: small delay between watchlist requests
            await new Promise((r) => setTimeout(r, 350));
          }
          results.push({
            username: entry.username,
            reason: entry.reason,
            recent_tweets: timeline,
          });
        } catch (err: any) {
          results.push({
            username: entry.username,
            reason: entry.reason,
            error: err.message,
          });
        }
      }

      console.log(JSON.stringify({ watchlist: results }, null, 2));
      break;
    }

    case "watchlist-add": {
      if (!positional) {
        console.error("Usage: x-search.ts watchlist-add <username> --reason \"why\"");
        process.exit(1);
      }

      const username = positional.replace(/^@/, "");
      const reason = flags["reason"] || "No reason specified";

      // Avoid duplicates
      if (config.watchlist.some((w: any) => w.username.toLowerCase() === username.toLowerCase())) {
        console.log(JSON.stringify({ message: `@${username} is already on the watchlist.` }));
        return;
      }

      config.watchlist.push({
        username,
        reason,
        added: new Date().toISOString().split("T")[0],
      });
      saveConfig(config);
      console.log(JSON.stringify({ message: `Added @${username} to watchlist.`, watchlist: config.watchlist }));
      break;
    }

    case "watchlist-remove": {
      if (!positional) {
        console.error("Usage: x-search.ts watchlist-remove <username>");
        process.exit(1);
      }

      const username = positional.replace(/^@/, "");
      const before = config.watchlist.length;
      config.watchlist = config.watchlist.filter(
        (w: any) => w.username.toLowerCase() !== username.toLowerCase()
      );

      if (config.watchlist.length === before) {
        console.log(JSON.stringify({ message: `@${username} was not on the watchlist.` }));
      } else {
        saveConfig(config);
        console.log(JSON.stringify({ message: `Removed @${username} from watchlist.`, watchlist: config.watchlist }));
      }
      break;
    }

    case "read": {
      if (!positional) {
        console.error("Usage: x-search.ts read <url-or-tweet-id> [--dry-run]");
        process.exit(1);
      }

      // Extract tweet ID from URL or use as-is if already an ID
      let tweetId = positional;
      const urlMatch = positional.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
      if (urlMatch) {
        tweetId = urlMatch[1];
      } else if (!/^\d+$/.test(tweetId)) {
        console.error(JSON.stringify({
          error: "Invalid input. Provide an X/Twitter URL (https://x.com/user/status/123) or a tweet ID (123)",
          input: positional,
        }));
        process.exit(1);
      }

      if (dryRun) {
        // In dry-run, return the mock thread for this ID
        const thread = mockGetThread(tweetId);
        console.log(JSON.stringify({
          source_url: positional,
          tweet_id: tweetId,
          ...thread,
        }, null, 2));
        return;
      }

      // Check cache
      const cachedThread = cache.get("threads", tweetId);
      if (cachedThread) {
        console.log(JSON.stringify({
          source_url: positional,
          tweet_id: tweetId,
          ...cachedThread,
          _cached: true,
        }, null, 2));
        return;
      }

      const readThread = await client!.getThread(tweetId);
      cache.set("threads", tweetId, readThread, 24 * 60 * 60 * 1000);
      console.log(JSON.stringify({
        source_url: positional,
        tweet_id: tweetId,
        ...readThread,
      }, null, 2));
      break;
    }

    case "help":
    default:
      console.log(`
X Research CLI — Thoth's X/Twitter search interface

Commands:
  search "query" [--max-results N] [--sort relevancy|recency] [--dry-run]
      Search tweets matching a query

  read <url-or-tweet-id> [--dry-run]
      Read a specific tweet/thread from a URL or tweet ID
      Accepts: https://x.com/user/status/123 or just 123

  thread <tweet-id> [--dry-run]
      Fetch a full tweet thread by its root tweet ID

  timeline <username> [--max-results N] [--dry-run]
      Fetch recent tweets from a user

  watchlist [--dry-run]
      Check all watchlisted accounts for recent activity

  watchlist-add <username> --reason "why"
      Add an account to the watchlist

  watchlist-remove <username>
      Remove an account from the watchlist

Flags:
  --dry-run    Use mock data instead of the live X API (for testing)
      `.trim());
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message, code: err.code || "UNKNOWN" }));
  process.exit(1);
});
