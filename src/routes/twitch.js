import { Hono } from 'hono';

export const twitchRoutes = new Hono();

// Twitchチャンネル情報取得
twitchRoutes.get('/:vtuber_id', async (c) => {
  const db = c.env.DB;
  const vtuber_id = c.req.param('vtuber_id');

  try {
    const { results } = await db
      .prepare('SELECT * FROM twitch_channels WHERE vtuber_id = ?')
      .bind(vtuber_id)
      .all();

    if (results.length === 0) {
      return c.json({ error: 'Twitch channel not found' }, 404);
    }

    return c.json({ data: results[0] });
  } catch (error) {
    console.error('Error fetching Twitch channel:', error);
    return c.json({ error: 'Failed to fetch Twitch channel' }, 500);
  }
});

// Twitchチャンネル追加/更新
twitchRoutes.post('/', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const {
      vtuber_id,
      channel_name,
      display_name,
      follower_count,
      view_count,
      profile_image_url,
    } = data;

    await db
      .prepare(`
        INSERT OR REPLACE INTO twitch_channels 
        (vtuber_id, channel_name, display_name, follower_count, view_count, profile_image_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        vtuber_id,
        channel_name,
        display_name || null,
        follower_count || 0,
        view_count || 0,
        profile_image_url || null
      )
      .run();

    return c.json({ message: 'Twitch channel saved successfully' }, 201);
  } catch (error) {
    console.error('Error saving Twitch channel:', error);
    return c.json({ error: 'Failed to save Twitch channel' }, 500);
  }
});
