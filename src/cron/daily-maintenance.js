import { enqueueJob, tableExists } from './utils.js';
import { runAITagging } from '../workers/ai-tagging.js';

export async function dailyMaintenance(env) {
  console.log('[Cron] Daily maintenance started');

  const db = env.DB;
  if (!db) {
    console.warn('[Cron] Daily maintenance skipped: DB not configured');
    return { jobs_enqueued: 0, skipped: 'no_db' };
  }

  let totalJobs = 0;

  try {
    const hasJobs = await tableExists(db, 'jobs');
    const hasYouTubeContents = await tableExists(db, 'youtube_contents');

    if (hasJobs && hasYouTubeContents) {
      const { results: withoutContents } = await db
        .prepare(`
          SELECT v.id, yc.channel_id
          FROM vtubers v
          JOIN youtube_channels yc ON v.id = yc.vtuber_id
          LEFT JOIN youtube_contents yco ON v.id = yco.vtuber_id
          WHERE yco.vtuber_id IS NULL
          LIMIT 50
        `)
        .all();

      for (const vtuber of withoutContents) {
        const result = await enqueueJob(
          db,
          'fetch_recent_contents',
          { vtuber_id: vtuber.id, channel_id: vtuber.channel_id },
          6
        );
        if (!result.skipped) {
          totalJobs += 1;
        }
      }
    } else if (hasJobs) {
      console.warn('[Cron] Daily maintenance: youtube_contents table not found, skipping contents collection');
    }

    if (hasJobs) {
      const { results: withoutTags } = await db
        .prepare(`
          SELECT v.id
          FROM vtubers v
          LEFT JOIN vtuber_tags vt ON v.id = vt.vtuber_id
          WHERE vt.vtuber_id IS NULL
          LIMIT 10
        `)
        .all();

      for (const vtuber of withoutTags) {
        const result = await enqueueJob(
          db,
          'ai_tagging_vtuber',
          { vtuber_id: vtuber.id },
          7
        );
        if (!result.skipped) {
          totalJobs += 1;
        }
      }
    } else if (env.OPENAI_API_KEY) {
      console.warn('[Cron] Daily maintenance: jobs table not found, running AI tagging directly');
      await runAITagging(env, 10);
    } else {
      console.warn('[Cron] Daily maintenance: jobs table not found, skipping AI tagging');
    }

    console.log(`[Cron] Daily maintenance completed: ${totalJobs} jobs enqueued`);
    return { jobs_enqueued: totalJobs };
  } catch (error) {
    console.error('[Cron] Daily maintenance failed:', error);
    return { jobs_enqueued: totalJobs, error: error.message };
  }
}
