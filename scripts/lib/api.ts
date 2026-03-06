/**
 * X API v2 client
 *
 * Handles authentication, request construction, rate limiting,
 * and exponential backoff for the X/Twitter API v2.
 */

import * as fs from "fs";
import * as https from "https";

const API_BASE = "https://api.x.com/2";

// Rate limit: minimum delay between requests (ms)
const MIN_REQUEST_INTERVAL = 350;

interface SearchOptions {
  maxResults?: number;
  sortOrder?: "relevancy" | "recency";
  excludeRetweets?: boolean;
  startTime?: string; // ISO 8601
  endTime?: string; // ISO 8601
  nextToken?: string;
}

interface Tweet {
  id: string;
  text: string;
  author_id: string;
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
  referenced_tweets?: Array<{ type: string; id: string }>;
}

interface SearchResult {
  query: string;
  tweets: Tweet[];
  total_results: number;
  next_token?: string;
  searched_at: string;
}

export class XApiClient {
  private bearerToken: string;
  private lastRequestTime: number = 0;

  constructor(envFilePath: string) {
    this.bearerToken = this.loadToken(envFilePath);
  }

  private loadToken(envFilePath: string): string {
    try {
      const content = fs.readFileSync(envFilePath, "utf-8");
      const match = content.match(/X_BEARER_TOKEN=(.+)/);
      if (!match) {
        throw new Error(
          `X_BEARER_TOKEN not found in ${envFilePath}. ` +
          `Add it like: X_BEARER_TOKEN=your_token_here`
        );
      }
      return match[1].trim();
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(
          `X API token file not found at ${envFilePath}. ` +
          `Create it with: echo "X_BEARER_TOKEN=your_token" > ${envFilePath}`
        );
      }
      throw err;
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async request(url: string, retries = 3): Promise<any> {
    await this.rateLimit();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.httpGet(url);

        if (response.statusCode === 429) {
          // Rate limited — exponential backoff
          const waitMs = Math.pow(2, attempt + 1) * 1000;
          console.error(`Rate limited. Waiting ${waitMs / 1000}s before retry...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        if (response.statusCode === 401) {
          throw new Error("Invalid X API Bearer Token. Check your token in ~/.openclaw/workspace/.env.x-api");
        }

        if (response.statusCode !== 200) {
          throw new Error(`X API returned status ${response.statusCode}: ${response.body}`);
        }

        return JSON.parse(response.body);
      } catch (err: any) {
        if (attempt === retries) throw err;
        if (err.message.includes("Invalid X API")) throw err; // Don't retry auth errors

        const waitMs = Math.pow(2, attempt) * 1000;
        console.error(`Request failed: ${err.message}. Retrying in ${waitMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  private httpGet(url: string): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            "User-Agent": "ThothResearchAgent/1.0",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () =>
            resolve({ statusCode: res.statusCode || 0, body })
          );
        }
      );
      req.on("error", reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Request timed out after 30s"));
      });
    });
  }

  async searchTweets(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const {
      maxResults = 50,
      sortOrder = "relevancy",
      excludeRetweets = true,
      startTime,
      endTime,
      nextToken,
    } = options;

    let fullQuery = query;
    if (excludeRetweets && !query.includes("-is:retweet")) {
      fullQuery += " -is:retweet";
    }

    const params = new URLSearchParams({
      query: fullQuery,
      max_results: String(Math.min(Math.max(maxResults, 10), 100)), // API requires 10–100
      sort_order: sortOrder,
      "tweet.fields": "id,text,author_id,created_at,public_metrics,conversation_id,referenced_tweets",
      expansions: "author_id",
      "user.fields": "id,username,name,public_metrics",
    });

    if (startTime) params.set("start_time", startTime);
    if (endTime) params.set("end_time", endTime);
    if (nextToken) params.set("next_token", nextToken);

    const url = `${API_BASE}/tweets/search/recent?${params}`;
    const data = await this.request(url);

    // Build user lookup map
    const users = new Map<string, any>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        users.set(user.id, user);
      }
    }

    // Transform to our tweet format
    const tweets: Tweet[] = (data.data || []).map((t: any) => {
      const author = users.get(t.author_id);
      return {
        id: t.id,
        text: t.text,
        author_id: t.author_id,
        author_username: author?.username,
        author_name: author?.name,
        author_followers: author?.public_metrics?.followers_count,
        created_at: t.created_at,
        url: author ? `https://x.com/${author.username}/status/${t.id}` : undefined,
        engagement: {
          likes: t.public_metrics?.like_count || 0,
          retweets: t.public_metrics?.retweet_count || 0,
          replies: t.public_metrics?.reply_count || 0,
          quotes: t.public_metrics?.quote_count || 0,
        },
        conversation_id: t.conversation_id,
        referenced_tweets: t.referenced_tweets,
      };
    });

    // Handle pagination for larger result sets
    let allTweets = [...tweets];
    let token = data.meta?.next_token;

    while (allTweets.length < maxResults && token) {
      const nextData = await this.request(
        `${API_BASE}/tweets/search/recent?${new URLSearchParams({
          ...Object.fromEntries(params),
          next_token: token,
        })}`
      );

      const nextUsers = new Map<string, any>();
      if (nextData.includes?.users) {
        for (const user of nextData.includes.users) {
          nextUsers.set(user.id, user);
        }
      }

      const nextTweets: Tweet[] = (nextData.data || []).map((t: any) => {
        const author = nextUsers.get(t.author_id) || users.get(t.author_id);
        return {
          id: t.id,
          text: t.text,
          author_id: t.author_id,
          author_username: author?.username,
          author_name: author?.name,
          author_followers: author?.public_metrics?.followers_count,
          created_at: t.created_at,
          url: author ? `https://x.com/${author.username}/status/${t.id}` : undefined,
          engagement: {
            likes: t.public_metrics?.like_count || 0,
            retweets: t.public_metrics?.retweet_count || 0,
            replies: t.public_metrics?.reply_count || 0,
            quotes: t.public_metrics?.quote_count || 0,
          },
          conversation_id: t.conversation_id,
          referenced_tweets: t.referenced_tweets,
        };
      });

      allTweets = [...allTweets, ...nextTweets];
      token = nextData.meta?.next_token;
    }

    return {
      query: fullQuery,
      tweets: allTweets.slice(0, maxResults),
      total_results: data.meta?.result_count || allTweets.length,
      next_token: token,
      searched_at: new Date().toISOString(),
    };
  }

  async getThread(tweetId: string): Promise<any> {
    // First, get the root tweet to find the conversation_id
    const tweetUrl = `${API_BASE}/tweets/${tweetId}?tweet.fields=conversation_id,author_id,created_at,public_metrics,referenced_tweets&expansions=author_id&user.fields=username,name,public_metrics`;
    const rootData = await this.request(tweetUrl);

    if (!rootData.data) {
      throw new Error(`Tweet ${tweetId} not found`);
    }

    const conversationId = rootData.data.conversation_id || tweetId;

    // Search for all tweets in this conversation
    const threadQuery = `conversation_id:${conversationId}`;
    const threadResults = await this.searchTweets(threadQuery, {
      maxResults: 100,
      sortOrder: "recency",
      excludeRetweets: false,
    });

    return {
      root_tweet_id: tweetId,
      conversation_id: conversationId,
      tweets: threadResults.tweets.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      fetched_at: new Date().toISOString(),
    };
  }

  async getUserTimeline(username: string, maxResults = 20): Promise<any> {
    // First, get the user ID from the username
    const userUrl = `${API_BASE}/users/by/username/${username}?user.fields=id,username,name,public_metrics,description`;
    const userData = await this.request(userUrl);

    if (!userData.data) {
      throw new Error(`User @${username} not found`);
    }

    const userId = userData.data.id;

    // Now fetch their timeline
    const timelineUrl = `${API_BASE}/users/${userId}/tweets?max_results=${Math.min(maxResults, 100)}&tweet.fields=id,text,created_at,public_metrics,conversation_id,referenced_tweets&expansions=author_id&user.fields=username,name,public_metrics`;
    const timelineData = await this.request(timelineUrl);

    const tweets: Tweet[] = (timelineData.data || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      author_id: userId,
      author_username: username,
      author_name: userData.data.name,
      author_followers: userData.data.public_metrics?.followers_count,
      created_at: t.created_at,
      url: `https://x.com/${username}/status/${t.id}`,
      engagement: {
        likes: t.public_metrics?.like_count || 0,
        retweets: t.public_metrics?.retweet_count || 0,
        replies: t.public_metrics?.reply_count || 0,
        quotes: t.public_metrics?.quote_count || 0,
      },
      conversation_id: t.conversation_id,
      referenced_tweets: t.referenced_tweets,
    }));

    return {
      user: {
        id: userId,
        username: userData.data.username,
        name: userData.data.name,
        description: userData.data.description,
        followers: userData.data.public_metrics?.followers_count,
        following: userData.data.public_metrics?.following_count,
        tweet_count: userData.data.public_metrics?.tweet_count,
      },
      tweets,
      fetched_at: new Date().toISOString(),
    };
  }
}
