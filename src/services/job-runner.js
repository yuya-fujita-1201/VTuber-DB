import { resolveChannelJob } from '../jobs/resolve-channel.js';
import { initialSyncChannelJob } from '../jobs/initial-sync-channel.js';
import { fetchRecentContentsJob } from '../jobs/fetch-recent-contents.js';
import { aiTaggingVtuberJob } from '../jobs/ai-tagging-vtuber.js';
import { buildTagRelationsJob } from '../jobs/build-tag-relations.js';

const JOB_HANDLERS = {
  resolve_channel: resolveChannelJob,
  initial_sync_channel: initialSyncChannelJob,
  fetch_recent_contents: fetchRecentContentsJob,
  ai_tagging_vtuber: aiTaggingVtuberJob,
  build_tag_relations: buildTagRelationsJob,
};

function normalizeErrorMessage(error) {
  if (!error) return null;
  if (typeof error === 'string') return error.slice(0, 1000);
  if (error instanceof Error) return (error.message || 'Unknown error').slice(0, 1000);
  try {
    return JSON.stringify(error).slice(0, 1000);
  } catch {
    return 'Unknown error';
  }
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error(`Invalid job payload: ${error.message}`);
  }
}

export async function pickNextJob(db) {
  const { results } = await db
    .prepare(`
      SELECT * FROM jobs
      WHERE status = 'queued'
        AND attempts < max_attempts
        AND (not_before IS NULL OR not_before <= CURRENT_TIMESTAMP)
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
    `)
    .all();

  return results[0] || null;
}

export async function markJobRunning(db, jobId) {
  const result = await db
    .prepare(`
      UPDATE jobs
      SET status = 'running',
          started_at = CURRENT_TIMESTAMP,
          last_error = NULL
      WHERE id = ?
        AND status = 'queued'
    `)
    .bind(jobId)
    .run();

  const updated = (result.meta?.changes || 0) > 0;
  if (updated) {
    await createJobRun(db, jobId, 'running');
  }

  return updated;
}

export async function markJobSuccess(db, jobId) {
  await db
    .prepare(`
      UPDATE jobs
      SET status = 'success',
          completed_at = CURRENT_TIMESTAMP,
          last_error = NULL
      WHERE id = ?
    `)
    .bind(jobId)
    .run();

  await createJobRun(db, jobId, 'success');
}

export async function markJobFailed(db, jobId, error) {
  const errorMessage = normalizeErrorMessage(error);
  const { results } = await db
    .prepare('SELECT attempts, max_attempts FROM jobs WHERE id = ?')
    .bind(jobId)
    .all();

  if (results.length === 0) {
    return { final: true, attempts: 0 };
  }

  const currentAttempts = results[0].attempts || 0;
  const maxAttempts = results[0].max_attempts || 3;
  const nextAttempts = currentAttempts + 1;
  const isFinal = nextAttempts >= maxAttempts;

  if (isFinal) {
    await db
      .prepare(`
        UPDATE jobs
        SET status = 'failed',
            attempts = ?,
            last_error = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(nextAttempts, errorMessage, jobId)
      .run();
  } else {
    const backoffMinutes = Math.min(60, Math.pow(2, nextAttempts - 1));
    await db
      .prepare(`
        UPDATE jobs
        SET status = 'queued',
            attempts = ?,
            last_error = ?,
            not_before = datetime('now', ?),
            started_at = NULL
        WHERE id = ?
      `)
      .bind(nextAttempts, errorMessage, `+${backoffMinutes} minutes`, jobId)
      .run();
  }

  await createJobRun(db, jobId, 'failed', errorMessage);
  return { final: isFinal, attempts: nextAttempts };
}

export async function createJobRun(db, jobId, status, error) {
  const errorMessage = normalizeErrorMessage(error);

  if (status === 'running') {
    return db
      .prepare('INSERT INTO job_runs (job_id, status) VALUES (?, ?)')
      .bind(jobId, status)
      .run();
  }

  const { results } = await db
    .prepare('SELECT id FROM job_runs WHERE job_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1')
    .bind(jobId, 'running')
    .all();

  if (results.length > 0) {
    return db
      .prepare(`
        UPDATE job_runs
        SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(status, errorMessage, results[0].id)
      .run();
  }

  return db
    .prepare(`
      INSERT INTO job_runs (job_id, status, error_message, completed_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(jobId, status, errorMessage)
    .run();
}

export async function executeJob(env, job) {
  const handler = JOB_HANDLERS[job.job_type];
  if (!handler) {
    throw new Error(`Unknown job type: ${job.job_type}`);
  }

  const payload = parsePayload(job.payload);
  return handler(env, payload, job);
}

export async function runNextJob(env) {
  const db = env.DB;
  const job = await pickNextJob(db);
  if (!job) {
    return { processed: 0 };
  }

  const locked = await markJobRunning(db, job.id);
  if (!locked) {
    return { processed: 0, skipped: true };
  }

  try {
    const result = await executeJob(env, job);
    await markJobSuccess(db, job.id);
    return { processed: 1, job_id: job.id, result };
  } catch (error) {
    await markJobFailed(db, job.id, error);
    return { processed: 1, job_id: job.id, error: normalizeErrorMessage(error) };
  }
}

export async function runJobQueue(env, { limit = 1 } = {}) {
  const results = [];

  for (let i = 0; i < limit; i++) {
    const outcome = await runNextJob(env);
    if (!outcome.processed) {
      break;
    }
    results.push(outcome);
  }

  return results;
}
