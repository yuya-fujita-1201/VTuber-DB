import { Hono } from 'hono';
import { syncYouTubeData, syncTwitterData, syncTwitchData } from '../workers/sync.js';
import { runAITagging } from '../workers/ai-tagging.js';

export const adminActionsRoutes = new Hono();

// 簡易認証ミドルウェア
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const adminPassword = c.env.ADMIN_PASSWORD;

  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
};

// すべての管理者アクションルートに認証を適用
adminActionsRoutes.use('/*', authMiddleware);

// YouTube同期実行
adminActionsRoutes.post('/sync/youtube', async (c) => {
  try {
    const result = await syncYouTubeData(c.env);
    return c.json(result);
  } catch (error) {
    console.error('Error running YouTube sync:', error);
    return c.json({ error: 'Failed to run YouTube sync' }, 500);
  }
});

// Twitter同期実行
adminActionsRoutes.post('/sync/twitter', async (c) => {
  try {
    const result = await syncTwitterData(c.env);
    return c.json(result);
  } catch (error) {
    console.error('Error running Twitter sync:', error);
    return c.json({ error: 'Failed to run Twitter sync' }, 500);
  }
});

// Twitch同期実行
adminActionsRoutes.post('/sync/twitch', async (c) => {
  try {
    const result = await syncTwitchData(c.env);
    return c.json(result);
  } catch (error) {
    console.error('Error running Twitch sync:', error);
    return c.json({ error: 'Failed to run Twitch sync' }, 500);
  }
});

// AIタグづけ実行
adminActionsRoutes.post('/ai-tagging', async (c) => {
  try {
    const { limit } = await c.req.json().catch(() => ({ limit: 100 }));
    const result = await runAITagging(c.env, limit);
    return c.json(result);
  } catch (error) {
    console.error('Error running AI tagging:', error);
    return c.json({ error: 'Failed to run AI tagging' }, 500);
  }
});
