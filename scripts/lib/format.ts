/**
 * Output formatting utilities
 *
 * Transforms raw tweet data into structured formats.
 * The primary output is JSON (the agent decides how to present to the user),
 * but these helpers make it easy to produce clean, consistent structures.
 */

interface Tweet {
  id: string;
  text: string;
  author_username?: string;
  author_name?: string;
  author_followers?: number;
  created_at: string;
  url?: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
  };
  conversation_id?: string;
}

/**
 * Calculate an engagement ratio relative to follower count.
 * This helps surface tweets that resonated beyond the author's usual reach.
 *
 * Ratio = (likes + 2*retweets + 3*replies) / max(followers, 1) * 1000
 * Higher = more resonant relative to audience size.
 *
 * Interpretation guide:
 *   > 500  — viral relative to audience (exceptional resonance)
 *   100-500 — strong engagement
 *   20-100  — above average
 *   < 20    — typical
 */
export function engagementRatio(tweet: Tweet): number {
  const { likes, retweets, replies } = tweet.engagement;
  const followers = Math.max(tweet.author_followers || 1, 1);
  return Math.round(((likes + 2 * retweets + 3 * replies) / followers) * 1000 * 100) / 100;
}

// Backward compatibility alias
export const engagementScore = engagementRatio;

/**
 * Compute a human-readable recency string from a tweet's created_at date.
 */
export function recencyLabel(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Sort tweets by engagement ratio (highest first)
 */
export function sortByEngagement(tweets: Tweet[]): Tweet[] {
  return [...tweets].sort((a, b) => engagementRatio(b) - engagementRatio(a));
}

/**
 * Filter out low-quality tweets:
 * - Very short (< 30 chars, likely reactions)
 * - Pure links with no commentary
 * - Tweets that are just @mentions
 */
export function filterNoise(tweets: Tweet[]): Tweet[] {
  return tweets.filter((t) => {
    const text = t.text.trim();

    // Too short to be substantive
    if (text.length < 30) return false;

    // Just a link
    if (/^https?:\/\/\S+$/.test(text)) return false;

    // Just @mentions
    if (/^(@\w+\s*)+$/.test(text)) return false;

    return true;
  });
}

/**
 * Deduplicate tweets by text similarity.
 * Removes near-duplicates (same text after normalizing whitespace and URLs).
 */
export function deduplicate(tweets: Tweet[]): Tweet[] {
  const seen = new Set<string>();
  return tweets.filter((t) => {
    const normalized = t.text
      .replace(/https?:\/\/\S+/g, "[link]")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Detect whether a tweet is likely part of or starting a thread.
 * Heuristics: contains thread indicators, has conversation_id different from id,
 * or has a high self-reply pattern.
 */
export function isLikelyThread(tweet: Tweet): boolean {
  if (tweet.conversation_id && tweet.conversation_id !== tweet.id) return true;
  const text = tweet.text.toLowerCase();
  if (text.includes("🧵") || text.includes("thread:") || text.includes("a thread")) return true;
  if (/\d+\/\d+/.test(text)) return true; // "1/12" style
  return false;
}

/**
 * Format the output as a structured JSON object.
 * This is the primary output format — the agent interprets and presents it.
 *
 * The `findings` array contains curated top results; `raw_tweets` contains
 * the full unfiltered set so the user can browse beyond the curation.
 */
export function formatOutput(
  query: string,
  searches: Array<{ query: string; angle: string; results: Tweet[] }>,
  options: { maxFindings?: number; researchLens?: string } = {}
): any {
  const maxFindings = options.maxFindings || 30;
  const researchLens = options.researchLens || "balanced";

  // Combine all results, deduplicate, filter noise, sort by engagement
  let allTweets = searches.flatMap((s) => s.results);
  const rawTweets = allTweets.map((t) => ({
    tweet_id: t.id,
    author: `@${t.author_username}`,
    text: t.text,
    url: t.url,
    engagement: t.engagement,
    engagement_ratio: engagementRatio(t),
    posted_at: t.created_at,
    recency: recencyLabel(t.created_at),
  }));

  allTweets = deduplicate(allTweets);
  allTweets = filterNoise(allTweets);
  allTweets = sortByEngagement(allTweets);

  const findings = allTweets.slice(0, maxFindings).map((t) => ({
    tweet_id: t.id,
    author: `@${t.author_username}`,
    author_followers: t.author_followers,
    text: t.text,
    url: t.url,
    engagement: t.engagement,
    engagement_ratio: engagementRatio(t),
    posted_at: t.created_at,
    recency: recencyLabel(t.created_at),
    is_thread: isLikelyThread(t),
    thread_id: (t.conversation_id && t.conversation_id !== t.id) ? t.conversation_id : undefined,
  }));

  return {
    query,
    research_lens: researchLens,
    timestamp: new Date().toISOString(),
    searches_executed: searches.map((s) => ({
      query: s.query,
      angle: s.angle,
      results_count: s.results.length,
      after_filtering: filterNoise(s.results).length,
    })),
    findings,
    raw_tweets: rawTweets,
    summary: {
      total_results_scanned: searches.reduce((sum, s) => sum + s.results.length, 0),
      total_findings: findings.length,
      threads_detected: findings.filter((f) => f.is_thread).length,
      top_authors: getTopAuthors(allTweets, 5),
    },
  };
}

/**
 * Get the most frequently appearing authors in the results
 */
function getTopAuthors(tweets: Tweet[], limit: number): Array<{ username: string; count: number; followers: number }> {
  const counts = new Map<string, { count: number; followers: number }>();

  for (const t of tweets) {
    if (!t.author_username) continue;
    const existing = counts.get(t.author_username) || { count: 0, followers: t.author_followers || 0 };
    existing.count++;
    counts.set(t.author_username, existing);
  }

  return Array.from(counts.entries())
    .map(([username, { count, followers }]) => ({ username, count, followers }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
