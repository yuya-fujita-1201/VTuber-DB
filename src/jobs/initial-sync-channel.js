import { YouTubeService } from '../services/youtube.js';
import { enqueueJob } from './job-utils.js';

export async function initialSyncChannelJob(env, payload) {
  const db = env.DB;
  const { channel_id, ingestion_request_id } = payload || {};

  if (!channel_id) {
    throw new Error('Missing channel_id in payload');
  }
  if (!env.YOUTUBE_API_KEY) {
    throw new Error('Missing YOUTUBE_API_KEY');
  }

  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);
  const channelInfo = await youtubeService.getChannelInfo(channel_id);

  const { results: existingChannels } = await db
    .prepare('SELECT vtuber_id FROM youtube_channels WHERE channel_id = ?')
    .bind(channel_id)
    .all();

  let vtuberId = existingChannels[0]?.vtuber_id || null;
  let createdVtuberId = null;

  if (!vtuberId) {
    const vtuberInsert = await db
      .prepare(`
        INSERT INTO vtubers (name, description, avatar_url)
        VALUES (?, ?, ?)
      `)
      .bind(
        channelInfo.channel_name,
        channelInfo.description || null,
        channelInfo.thumbnail_url || null
      )
      .run();

    vtuberId = vtuberInsert.meta.last_row_id;
    createdVtuberId = vtuberId;
  }

  await db
    .prepare(`
      INSERT INTO youtube_channels (
        vtuber_id,
        channel_id,
        channel_name,
        subscriber_count,
        view_count,
        video_count,
        custom_url,
        thumbnail_url,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_name = excluded.channel_name,
        subscriber_count = excluded.subscriber_count,
        view_count = excluded.view_count,
        video_count = excluded.video_count,
        custom_url = excluded.custom_url,
        thumbnail_url = excluded.thumbnail_url,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      vtuberId,
      channelInfo.channel_id,
      channelInfo.channel_name,
      channelInfo.subscriber_count,
      channelInfo.view_count,
      channelInfo.video_count,
      channelInfo.custom_url,
      channelInfo.thumbnail_url
    )
    .run();

  if (createdVtuberId) {
    const { results: channelRows } = await db
      .prepare('SELECT vtuber_id FROM youtube_channels WHERE channel_id = ?')
      .bind(channel_id)
      .all();

    const resolvedVtuberId = channelRows[0]?.vtuber_id;
    if (resolvedVtuberId && resolvedVtuberId !== createdVtuberId) {
      await db
        .prepare('DELETE FROM vtubers WHERE id = ?')
        .bind(createdVtuberId)
        .run();
      vtuberId = resolvedVtuberId;
    }
  }

  if (vtuberId) {
    await db
      .prepare(`
        UPDATE vtubers
        SET name = ?,
            description = ?,
            avatar_url = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        channelInfo.channel_name,
        channelInfo.description || null,
        channelInfo.thumbnail_url || null,
        vtuberId
      )
      .run();
  }

  if (ingestion_request_id) {
    await db
      .prepare('UPDATE ingestion_requests SET status = ? WHERE id = ?')
      .bind('resolved', ingestion_request_id)
      .run();
  }

  await enqueueJob(
    db,
    'fetch_recent_contents',
    { vtuber_id: vtuberId, channel_id: channelInfo.channel_id },
    { priority: 5, dedupe: { channel_id: channelInfo.channel_id } }
  );

  await enqueueJob(
    db,
    'ai_tagging_vtuber',
    { vtuber_id: vtuberId },
    { priority: 6, dedupe: { vtuber_id: vtuberId } }
  );

  return {
    vtuber_id: vtuberId,
    channel_id: channelInfo.channel_id,
  };
}
