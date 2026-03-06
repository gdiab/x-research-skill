/**
 * Mock data generator for dry-run testing
 *
 * Generates realistic-looking tweet data so the full skill flow
 * can be tested without hitting the X API or burning credits.
 */

const MOCK_USERS = [
  { id: "1001", username: "techskeptic42", name: "Sarah Chen", followers: 12400, description: "Staff eng @ BigCo. Opinions are compiler errors." },
  { id: "1002", username: "ai_optimist", name: "Marcus Webb", followers: 89000, description: "Building the future with AI. Ex-Google, now founder." },
  { id: "1003", username: "devpragmatist", name: "Jamie Torres", followers: 3200, description: "Senior dev. Ship it, then improve it." },
  { id: "1004", username: "ventureviews", name: "Priya Kapoor", followers: 45000, description: "VC partner. Deep tech + enterprise SaaS." },
  { id: "1005", username: "indie_builder", name: "Alex Nowak", followers: 7800, description: "Solo founder. Building in public." },
  { id: "1006", username: "datadriven_pm", name: "Lin Zhang", followers: 21000, description: "PM lead. Data > opinions." },
  { id: "1007", username: "benedictevans", name: "Benedict Evans", followers: 430000, description: "Tech analyst. Newsletter at ben-evans.com" },
  { id: "1008", username: "balaborges", name: "Bala Borges", followers: 15000, description: "Emerging markets tech. VC scout." },
];

const MOCK_TWEET_TEMPLATES: Record<string, Array<{ text: string; engagement: { likes: number; retweets: number; replies: number; quotes: number }; sentiment: string }>> = {
  "ai_agents_replace_juniors": [
    { text: "Hot take: AI agents won't replace junior devs. They'll replace the *tasks* junior devs hate doing. The juniors who learn to wield these tools will be 5x more productive than seniors who refuse to.", engagement: { likes: 892, retweets: 234, replies: 156, quotes: 45 }, sentiment: "supporting" },
    { text: "We tried replacing our junior dev pipeline with AI agents for 3 months. Result: code quality dropped, tech debt exploded, and we rehired. The agents are great at generating code but terrible at understanding *why* the code needs to exist.", engagement: { likes: 2341, retweets: 567, replies: 423, quotes: 89 }, sentiment: "opposing" },
    { text: "The question isn't whether AI replaces junior devs. It's whether companies will *hire* juniors when AI can do 80% of entry-level work. That's the real structural risk nobody talks about.", engagement: { likes: 456, retweets: 123, replies: 89, quotes: 34 }, sentiment: "neutral" },
    { text: "Every generation of dev tools was supposed to 'replace' someone. IDEs didn't replace devs. Stack Overflow didn't replace devs. GitHub Copilot didn't replace devs. AI agents won't either. The bar just moves.", engagement: { likes: 1567, retweets: 389, replies: 201, quotes: 67 }, sentiment: "opposing" },
    { text: "I'm a junior dev and I use Claude Code daily. I'm not being replaced — I'm learning 3x faster because I can ask the AI to explain every pattern it suggests. The juniors who'll struggle are the ones who don't use these tools.", engagement: { likes: 678, retweets: 145, replies: 98, quotes: 23 }, sentiment: "supporting" },
    { text: "Data point: our team shipped a feature in 2 days that would have taken our junior dev 2 weeks. The agent wrote the boilerplate, the junior reviewed and refined. That's the model — augmentation, not replacement.", engagement: { likes: 345, retweets: 78, replies: 56, quotes: 12 }, sentiment: "supporting" },
    { text: "If your junior dev's entire job can be replaced by an AI agent, you had a bad job description, not a replaceable human. Good junior roles are about learning systems thinking, not just writing CRUD endpoints.", engagement: { likes: 3200, retweets: 890, replies: 345, quotes: 123 }, sentiment: "opposing" },
    { text: "Thread: I surveyed 200 engineering managers about AI agents and junior hiring. Key finding: 62% plan to hire *fewer* juniors in 2027, but 78% say the juniors they DO hire will need stronger fundamentals, not weaker ones. 🧵", engagement: { likes: 1890, retweets: 456, replies: 234, quotes: 78 }, sentiment: "neutral" },
  ],
  "apple_vision_pro_sales": [
    { text: "Apple Vision Pro Q1 numbers are... not great. The device is incredible technology looking for a use case. Spatial computing is real but the price point gates adoption too aggressively.", engagement: { likes: 567, retweets: 134, replies: 89, quotes: 23 }, sentiment: "opposing" },
    { text: "Everyone dunking on Vision Pro sales is missing the point. Apple spent $200M+ on the platform. They're playing a 10-year game. iPhone sold 6M units in year one. Vision Pro is on a similar trajectory for a $3500 device.", engagement: { likes: 1234, retweets: 345, replies: 178, quotes: 56 }, sentiment: "supporting" },
    { text: "The Vision Pro return rate tells the real story. People love the demo, buy it, then realize they don't have a daily use case. Apple needs a killer app, not better hardware.", engagement: { likes: 890, retweets: 234, replies: 145, quotes: 34 }, sentiment: "opposing" },
    { text: "Spoke with 3 enterprise buyers who deployed Vision Pro for remote collaboration. All 3 are expanding their orders. Consumer story is meh but enterprise spatial computing is quietly taking off.", engagement: { likes: 456, retweets: 112, replies: 67, quotes: 19 }, sentiment: "supporting" },
    { text: "Apple Vision Pro sales dropped 40% QoQ. At this rate the installed base will be <1M by end of 2026. For context, AirPods hit 1M in their first month.", engagement: { likes: 2100, retweets: 567, replies: 312, quotes: 89 }, sentiment: "neutral" },
  ],
  "venture_capital_2026": [
    { text: "VC in 2026 is basically: if you're AI, here's $50M at seed. If you're anything else, write a 40-page memo explaining why you're not AI.", engagement: { likes: 3400, retweets: 890, replies: 456, quotes: 123 }, sentiment: "opposing" },
    { text: "Unpopular opinion: the VC market is actually healthier now than in 2021. Valuations are more rational, founders are more capital-efficient, and the tourists have left. This is what a functioning market looks like.", engagement: { likes: 567, retweets: 145, replies: 89, quotes: 34 }, sentiment: "supporting" },
    { text: "The bifurcation in VC is wild. Top-quartile firms are raising bigger funds than ever. Everyone else is struggling to deploy. The middle of the market is hollowing out.", engagement: { likes: 1200, retweets: 345, replies: 178, quotes: 56 }, sentiment: "neutral" },
    { text: "Just closed our Series A. Took 8 months and 47 meetings. In 2021 it would have taken 3 weeks. The bar is genuinely higher now and honestly that's probably good for the ecosystem even though it sucked for us.", engagement: { likes: 890, retweets: 234, replies: 145, quotes: 34 }, sentiment: "neutral" },
    { text: "Hot take from someone who's been in VC for 20 years: we're in a bubble within a correction. AI valuations are 2021-level irrational while everything else is overcorrected. The mean reversion on both sides will be painful.", engagement: { likes: 2300, retweets: 567, replies: 312, quotes: 89 }, sentiment: "opposing" },
  ],
  "default": [
    { text: "Interesting thread on this topic. The nuance that most people miss is that it's not binary — there's a spectrum of outcomes and we're probably going to land somewhere in the middle.", engagement: { likes: 234, retweets: 56, replies: 34, quotes: 12 }, sentiment: "neutral" },
    { text: "I've been thinking about this a lot lately and I think the contrarian view is actually correct here. The consensus narrative is too simple.", engagement: { likes: 567, retweets: 123, replies: 78, quotes: 23 }, sentiment: "neutral" },
    { text: "Data point that might be relevant: we ran an internal analysis on this and the results surprised everyone on the team. Will share more when I can.", engagement: { likes: 890, retweets: 234, replies: 156, quotes: 45 }, sentiment: "neutral" },
    { text: "Strong disagree. The evidence doesn't support this narrative at all. Here's why...", engagement: { likes: 345, retweets: 89, replies: 67, quotes: 19 }, sentiment: "opposing" },
    { text: "This is exactly right. We've seen the same pattern play out in our industry and the trajectory is clear.", engagement: { likes: 678, retweets: 178, replies: 98, quotes: 34 }, sentiment: "supporting" },
  ],
};

function pickUsers(count: number): typeof MOCK_USERS {
  const shuffled = [...MOCK_USERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function matchTopic(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("ai") && (q.includes("junior") || q.includes("replace") || q.includes("agent"))) {
    return "ai_agents_replace_juniors";
  }
  if (q.includes("vision pro") || q.includes("apple") && q.includes("sales")) {
    return "apple_vision_pro_sales";
  }
  if (q.includes("venture") || q.includes("vc") || q.includes("capital")) {
    return "venture_capital_2026";
  }
  return "default";
}

export function mockSearchTweets(query: string, maxResults: number = 10): any {
  const topic = matchTopic(query);
  const templates = MOCK_TWEET_TEMPLATES[topic] || MOCK_TWEET_TEMPLATES["default"];
  const users = pickUsers(templates.length);
  const now = Date.now();

  const tweets = templates.slice(0, maxResults).map((t, i) => {
    const user = users[i % users.length];
    const tweetId = `mock_${now}_${i}`;
    const createdAt = new Date(now - (i * 3600000 + Math.random() * 86400000)).toISOString();

    return {
      id: tweetId,
      text: t.text,
      author_id: user.id,
      author_username: user.username,
      author_name: user.name,
      author_followers: user.followers,
      created_at: createdAt,
      url: `https://x.com/${user.username}/status/${tweetId}`,
      engagement: t.engagement,
      conversation_id: tweetId,
      referenced_tweets: [],
    };
  });

  return {
    query,
    tweets,
    total_results: tweets.length,
    searched_at: new Date().toISOString(),
    _mock: true,
  };
}

export function mockGetThread(tweetId: string): any {
  const users = pickUsers(3);
  const now = Date.now();

  const tweets = [
    { text: "Starting a thread on something I've been thinking about for a while. This is going to be a long one so buckle up. 🧵", engagement: { likes: 890, retweets: 234, replies: 56, quotes: 23 } },
    { text: "First, some context. The conventional wisdom here is wrong and I think I can show why with data.", engagement: { likes: 456, retweets: 112, replies: 34, quotes: 12 } },
    { text: "Here's the key insight: when you look at the actual numbers, the trend is moving in the opposite direction from what most people assume.", engagement: { likes: 678, retweets: 178, replies: 45, quotes: 19 } },
    { text: "So what does this mean in practice? Three things: 1) The market is shifting faster than expected 2) Early movers have a real advantage 3) The window is closing", engagement: { likes: 1200, retweets: 345, replies: 89, quotes: 34 } },
    { text: "Final thought: I could be wrong about the timeline, but I'm very confident about the direction. The question isn't if, it's when. /end", engagement: { likes: 567, retweets: 145, replies: 78, quotes: 23 } },
  ].map((t, i) => ({
    id: `mock_thread_${tweetId}_${i}`,
    text: t.text,
    author_id: users[0].id,
    author_username: users[0].username,
    author_name: users[0].name,
    author_followers: users[0].followers,
    created_at: new Date(now - (4 - i) * 120000).toISOString(),
    url: `https://x.com/${users[0].username}/status/mock_thread_${tweetId}_${i}`,
    engagement: t.engagement,
    conversation_id: `mock_thread_${tweetId}_0`,
  }));

  return {
    root_tweet_id: tweetId,
    conversation_id: `mock_thread_${tweetId}_0`,
    tweets,
    fetched_at: new Date().toISOString(),
    _mock: true,
  };
}

export function mockGetUserTimeline(username: string, maxResults: number = 10): any {
  const user = MOCK_USERS.find(u => u.username.toLowerCase() === username.toLowerCase()) || {
    id: "9999",
    username,
    name: username,
    followers: 10000,
    description: `Mock profile for @${username}`,
  };

  const topic = "default";
  const templates = MOCK_TWEET_TEMPLATES[topic];
  const now = Date.now();

  const tweets = templates.slice(0, maxResults).map((t, i) => ({
    id: `mock_tl_${now}_${i}`,
    text: t.text,
    author_id: user.id,
    author_username: user.username,
    author_name: user.name,
    author_followers: user.followers,
    created_at: new Date(now - i * 7200000).toISOString(),
    url: `https://x.com/${user.username}/status/mock_tl_${now}_${i}`,
    engagement: t.engagement,
    conversation_id: `mock_tl_${now}_${i}`,
  }));

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      description: user.description,
      followers: user.followers,
      following: Math.floor(user.followers * 0.3),
      tweet_count: Math.floor(user.followers * 1.5),
    },
    tweets,
    fetched_at: new Date().toISOString(),
    _mock: true,
  };
}
