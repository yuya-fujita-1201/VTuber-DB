import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { vtuberRoutes } from './routes/vtubers';
import { youtubeRoutes } from './routes/youtube';

import { tagRoutes } from './routes/tags';
import { adminRoutes } from './routes/admin';
import { adminActionsRoutes } from './routes/admin-actions';
import { searchRoutes } from './routes/search';
import { bulkImportRoutes } from './routes/bulk-import';

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

app.route('/api/tags', tagRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin', adminActionsRoutes);
app.route('/api/search', searchRoutes);
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
