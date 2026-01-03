import { Hono } from 'hono';
import { enqueueJob } from '../jobs/job-utils.js';

export const ingestionRoutes = new Hono();

const isValidYouTubeUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'youtu.be') {
      return true;
    }

    if (hostname.endsWith('youtube.com')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

// VTuber追加リクエストの受付
// POST /api/ingestion-requests
// body: { url: "https://www.youtube.com/@example" }
ingestionRoutes.post('/', async (c) => {
  const db = c.env.DB;
  let data = null;

  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const url = typeof data?.url === 'string' ? data.url.trim() : '';

  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  if (!isValidYouTubeUrl(url)) {
    return c.json({ error: 'Invalid YouTube URL' }, 400);
  }

  try {
    const result = await db
      .prepare('INSERT INTO ingestion_requests (requested_url, status) VALUES (?, ?)')
      .bind(url, 'queued')
      .run();

    const requestId = result?.meta?.last_row_id;

    await enqueueJob(
      db,
      'resolve_channel',
      { url, ingestion_request_id: requestId },
      { priority: 3, dedupe: { url } }
    );

    return c.json({
      success: true,
      request_id: requestId,
      message: 'リクエストを受け付けました。処理には数分かかる場合があります。',
    }, 201);
  } catch (error) {
    console.error('Error creating ingestion request:', error);
    return c.json({ error: 'Failed to create ingestion request' }, 500);
  }
});
