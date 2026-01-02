import { Hono } from 'hono';

export const youtubeRoutes = new Hono();

// YouTubeチャンネル情報取得
youtubeRoutes.get('/:vtuber_id', async (c) => {
  const db = c.env.DB;
  const vtuber_id = c.req.param('vtuber_id');

  try {
    const { results } = await db
      .prepare('SELECT * FROM youtube_channels WHERE vtuber_id = ?')
      .bind(vtuber_id)
      .all();

    if (results.length === 0) {
      return c.json({ error: 'YouTube channel not found' }, 404);
    }

    return c.json({ data: results[0] });
  } catch (error) {
    console.error('Error fetching YouTube channel:', error);
    return c.json({ error: 'Failed to fetch YouTube channel' }, 500);
  }
});

// YouTubeチャンネル追加/更新
youtubeRoutes.post('/', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const {
      vtuber_id,
      channel_id,
      channel_name,
      subscriber_count,
      view_count,
      video_count,
      custom_url,
      thumbnail_url,
    } = data;

    await db
      .prepare(`
        INSERT OR REPLACE INTO youtube_channels 
        (vtuber_id, channel_id, channel_name, subscriber_count, view_count, video_count, custom_url, thumbnail_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        vtuber_id,
        channel_id,
        channel_name || null,
        subscriber_count || 0,
        view_count || 0,
        video_count || 0,
        custom_url || null,
        thumbnail_url || null
      )
      .run();

    return c.json({ message: 'YouTube channel saved successfully' }, 201);
  } catch (error) {
    console.error('Error saving YouTube channel:', error);
    return c.json({ error: 'Failed to save YouTube channel' }, 500);
  }
});
