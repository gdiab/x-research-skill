# X API v2 Quick Reference

## Search Query Syntax

The X API v2 search endpoint supports a rich query language. Here are the most useful operators:

### Basic
- `keyword` — matches tweets containing the word
- `"exact phrase"` — matches the exact phrase
- `keyword1 keyword2` — both words must appear (AND)
- `keyword1 OR keyword2` — either word (OR)
- `-keyword` — exclude tweets containing the word
- `(group1) OR (group2)` — grouping with parentheses

### Filters
- `from:username` — tweets by a specific user
- `to:username` — replies to a specific user
- `@username` — mentions of a user
- `is:reply` / `-is:reply` — include/exclude replies
- `-is:retweet` — exclude retweets (recommended for research)
- `is:quote` — only quote tweets
- `has:links` — tweets containing links
- `has:media` — tweets with images/video
- `has:images` — tweets with images specifically
- `lang:en` — filter by language

### Engagement (requires Academic or Enterprise access)
- `min_retweets:N` — minimum retweet count
- `min_faves:N` — minimum like count
- `min_replies:N` — minimum reply count

### Time
- `since:YYYY-MM-DD` — tweets after this date (in query)
- `until:YYYY-MM-DD` — tweets before this date (in query)
- Or use `start_time`/`end_time` API parameters (ISO 8601)

### Conversations
- `conversation_id:ID` — all tweets in a conversation thread

## Useful Query Patterns

### Find discourse on a topic
```
"AI coding assistants" -is:retweet lang:en
```

### Find opposing viewpoints
```
"AI coding" (overrated OR overhyped OR "waste of time" OR "doesn't work") -is:retweet
```

### Find supporting viewpoints
```
"AI coding" (amazing OR "game changer" OR "love" OR "incredible") -is:retweet
```

### Monitor a specific account's takes
```
from:username -is:retweet
```

### Find threads (long-form takes)
```
"topic" is:reply self_thread -is:retweet
```

## Rate Limits (Basic tier)

| Endpoint | Rate limit | Window |
|----------|-----------|--------|
| Search recent | 60 req | 15 min |
| Tweet lookup | 300 req | 15 min |
| User lookup | 300 req | 15 min |
| User timeline | 900 req | 15 min |

## Response Fields

When requesting `tweet.fields`, useful fields include:
- `id`, `text`, `author_id`, `created_at`
- `public_metrics` (likes, retweets, replies, quotes)
- `conversation_id` (for thread detection)
- `referenced_tweets` (for finding quote tweets, replies)
- `context_annotations` (topic/entity labels from X)

When requesting `user.fields`:
- `id`, `username`, `name`, `description`
- `public_metrics` (followers, following, tweet count)
- `verified`, `verified_type`
