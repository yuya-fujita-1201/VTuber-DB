import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { vtuberRoutes } from './routes/vtubers';
import { youtubeRoutes } from './routes/youtube';

import { tagRoutes } from './routes/tags';
import { tagsTreeRoutes } from './routes/tags-tree';
import { tagsSlugRoutes } from './routes/tags-slug';
import { adminRoutes } from './routes/admin';
import { adminActionsRoutes } from './routes/admin-actions';
import { searchRoutes } from './routes/search';
import { bulkImportRoutes } from './routes/bulk-import';
import { ingestionRoutes } from './routes/ingestion';

const app = new Hono();

// CORS設定
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ヘルスチェック
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'VTuber Database API',
    version: '1.0.0',
  });
});

// ルーティング
app.route('/api/vtubers', vtuberRoutes);
app.route('/api/youtube', youtubeRoutes);

app.route('/api/tags', tagsTreeRoutes);
app.route('/api/tags', tagRoutes);
app.route('/api/tags', tagsSlugRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin', adminActionsRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/ingestion-requests', ingestionRoutes);

// 統計情報の直接ルート（/api/stats）
app.get('/api/stats', async (c) => {
  const db = c.env.DB;
  try {
    const { results: totalResults } = await db.prepare('SELECT COUNT(*) as total FROM vtubers').all();
    const { results: agencyResults } = await db.prepare('SELECT COUNT(DISTINCT agency) as total FROM vtubers WHERE agency IS NOT NULL').all();
    const { results: subscriberResults } = await db.prepare('SELECT SUM(subscriber_count) as total FROM youtube_channels').all();
    const { results: tagResults } = await db.prepare('SELECT COUNT(*) as total FROM tags').all();
    return c.json({
      total_vtubers: totalResults[0]?.total || 0,
      total_agencies: agencyResults[0]?.total || 0,
      total_youtube_subscribers: subscriberResults[0]?.total || 0,
      total_tags: tagResults[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});
app.route('/api/bulk-import', bulkImportRoutes);

// エラーハンドリング
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

// 404ハンドリング
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  }, 404);
});

import { handleScheduled } from './scheduled.js';

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
};
