import { Hono } from 'hono';

export const twitterRoutes = new Hono();

// Twitterアカウント情報取得
twitterRoutes.get('/:vtuber_id', async (c) => {
  const db = c.env.DB;
  const vtuber_id = c.req.param('vtuber_id');

  try {
    const { results } = await db
      .prepare('SELECT * FROM twitter_accounts WHERE vtuber_id = ?')
      .bind(vtuber_id)
      .all();

    if (results.length === 0) {
      return c.json({ error: 'Twitter account not found' }, 404);
    }

    return c.json({ data: results[0] });
  } catch (error) {
    console.error('Error fetching Twitter account:', error);
    return c.json({ error: 'Failed to fetch Twitter account' }, 500);
  }
});

// Twitterアカウント追加/更新
twitterRoutes.post('/', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const {
      vtuber_id,
      username,
      display_name,
      follower_count,
      following_count,
      tweet_count,
      profile_image_url,
    } = data;

    await db
      .prepare(`
        INSERT OR REPLACE INTO twitter_accounts 
        (vtuber_id, username, display_name, follower_count, following_count, tweet_count, profile_image_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        vtuber_id,
        username,
        display_name || null,
        follower_count || 0,
        following_count || 0,
        tweet_count || 0,
        profile_image_url || null
      )
      .run();

    return c.json({ message: 'Twitter account saved successfully' }, 201);
  } catch (error) {
    console.error('Error saving Twitter account:', error);
    return c.json({ error: 'Failed to save Twitter account' }, 500);
  }
});
