import { YouTubeService } from '../services/youtube.js';

export async function fetchRecentContentsJob(env, payload) {
  const db = env.DB;
  const { vtuber_id, channel_id } = payload || {};

  if (!channel_id) {
    throw new Error('Missing channel_id in payload');
  }
  if (!env.YOUTUBE_API_KEY) {
    throw new Error('Missing YOUTUBE_API_KEY');
  }

  let vtuberId = vtuber_id || null;
  if (!vtuberId) {
    const { results } = await db
      .prepare('SELECT vtuber_id FROM youtube_channels WHERE channel_id = ?')
      .bind(channel_id)
      .all();
    vtuberId = results[0]?.vtuber_id || null;
  }

  if (!vtuberId) {
    throw new Error('VTuber not found for channel');
  }

  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);
  const videos = await youtubeService.getLatestVideos(channel_id, 30);

  for (const video of videos) {
    await db
      .prepare(`
        INSERT INTO youtube_contents (
          vtuber_id,
          channel_id,
          video_id,
          title,
          description,
          published_at,
          thumbnail_url,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(video_id) DO UPDATE SET
          vtuber_id = excluded.vtuber_id,
          channel_id = excluded.channel_id,
          title = excluded.title,
          description = excluded.description,
          published_at = excluded.published_at,
          thumbnail_url = excluded.thumbnail_url,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        vtuberId,
        channel_id,
        video.video_id,
        video.title,
        video.description || null,
        video.published_at,
        video.thumbnail_url
      )
      .run();
  }

  if (videos.length > 0) {
    const videoIds = videos.map(video => video.video_id);
    const placeholders = videoIds.map(() => '?').join(', ');
    await db
      .prepare(`
        DELETE FROM youtube_contents
        WHERE channel_id = ?
          AND video_id NOT IN (${placeholders})
      `)
      .bind(channel_id, ...videoIds)
      .run();
  }

  return { channel_id, vtuber_id: vtuberId, count: videos.length };
}
