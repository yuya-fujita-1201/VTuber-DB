import { columnExists, tableExists, enqueueJob } from './utils.js';
import { YouTubeService } from '../services/youtube.js';

async function updateChannelsDirect(db, youtubeService, channels) {
  if (channels.length === 0) {
    return { updated: 0, errors: 0 };
  }

  const channelIds = channels.map((c) => c.channel_id);
  const channelInfos = await youtubeService.getBatchChannelInfo(channelIds);

  let updated = 0;
  let errors = 0;

  for (const info of channelInfos) {
    try {
      await db
        .prepare(`
          UPDATE youtube_channels
          SET channel_name = ?,
              subscriber_count = ?,
              view_count = ?,
              video_count = ?,
              custom_url = ?,
              thumbnail_url = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE channel_id = ?
        `)
        .bind(
          info.channel_name,
          info.subscriber_count,
          info.view_count,
          info.video_count,
          info.custom_url,
          info.thumbnail_url,
          info.channel_id
        )
        .run();
      updated += 1;
    } catch (error) {
      console.error(`[Cron] Daily update: failed to update ${info.channel_id}`, error);
      errors += 1;
    }
  }

  return { updated, errors };
}

export async function dailyUpdate(env) {
  console.log('[Cron] Daily update started');

  const db = env.DB;
  if (!db) {
    console.warn('[Cron] Daily update skipped: DB not configured');
    return { updated: 0, skipped: 'no_db' };
  }

  try {
    let vtubers = [];
    if (await columnExists(db, 'vtubers', 'sync_tier')) {
      const { results } = await db
        .prepare('SELECT id, channel_id FROM vtubers WHERE sync_tier = 1 LIMIT 100')
        .all();
      vtubers = results;
    } else {
      const { results } = await db
        .prepare(`
          SELECT v.id, yc.channel_id
          FROM vtubers v
          JOIN youtube_channels yc ON v.id = yc.vtuber_id
          ORDER BY yc.subscriber_count DESC
          LIMIT 100
        `)
        .all();
      vtubers = results;
    }

    if (vtubers.length === 0) {
      console.log('[Cron] Daily update completed: 0 targets');
      return { updated: 0 };
    }

    if (await tableExists(db, 'jobs')) {
      let enqueued = 0;
      for (const vtuber of vtubers) {
        const result = await enqueueJob(
          db,
          'initial_sync_channel',
          { vtuber_id: vtuber.id, channel_id: vtuber.channel_id },
          5
        );
        if (!result.skipped) {
          enqueued += 1;
        }
      }
      console.log(`[Cron] Daily update completed: ${enqueued} jobs enqueued`);
      return { updated: enqueued, mode: 'enqueue' };
    }

    if (!env.YOUTUBE_API_KEY) {
      console.warn('[Cron] Daily update skipped: jobs table missing and YOUTUBE_API_KEY not configured');
      return { updated: 0, skipped: 'no_jobs_table' };
    }

    const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);
    const result = await updateChannelsDirect(db, youtubeService, vtubers);
    console.log(`[Cron] Daily update completed: ${result.updated} updated, ${result.errors} errors`);
    return { updated: result.updated, errors: result.errors, mode: 'direct' };
  } catch (error) {
    console.error('[Cron] Daily update failed:', error);
    return { updated: 0, error: error.message };
  }
}
