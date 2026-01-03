import { enqueueJob } from './utils.js';

export async function weeklyCollect(env) {
  console.log('[Cron] Weekly collect started');

  const db = env.DB;
  if (!db) {
    console.warn('[Cron] Weekly collect skipped: DB not configured');
    return { collected: 0, enqueued: 0, skipped: 'no_db' };
  }

  try {
    const payload = {
      targetCount: 100,
      order: 'date',
      skipExisting: true,
    };

    const result = await enqueueJob(db, 'mass_collect_vtubers', payload, 4);
    if (result.skipped) {
      console.warn('[Cron] Weekly collect skipped: jobs table not found');
      return { collected: 0, enqueued: 0, skipped: 'no_jobs_table' };
    }

    console.log('[Cron] Weekly collect completed: 1 job enqueued');
    return { collected: 0, enqueued: 1 };
  } catch (error) {
    console.error('[Cron] Weekly collect failed:', error);
    return { collected: 0, enqueued: 0, error: error.message };
  }
}
