import { Hono } from 'hono';

export const adminRoutes = new Hono();

// 簡易認証ミドルウェア
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const adminPassword = c.env.ADMIN_PASSWORD;

  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
};

// すべての管理者ルートに認証を適用
adminRoutes.use('/*', authMiddleware);

// 更新ログ一覧取得
adminRoutes.get('/logs', async (c) => {
  const db = c.env.DB;
  const { limit = 50, offset = 0, task_type } = c.req.query();

  try {
    let query = 'SELECT * FROM update_logs';
    const params = [];

    if (task_type) {
      query += ' WHERE task_type = ?';
      params.push(task_type);
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all();

    return c.json({ data: results });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return c.json({ error: 'Failed to fetch logs' }, 500);
  }
});

// 更新ログ作成
adminRoutes.post('/logs', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { task_type, status, records_processed, error_message } = data;

    const result = await db
      .prepare(`
        INSERT INTO update_logs (task_type, status, records_processed, error_message, completed_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(task_type, status, records_processed || 0, error_message || null)
      .run();

    return c.json({
      id: result.meta.last_row_id,
      message: 'Log created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating log:', error);
    return c.json({ error: 'Failed to create log' }, 500);
  }
});

// 未承認タグ一覧取得
adminRoutes.get('/unverified-tags', async (c) => {
  const db = c.env.DB;

  try {
    const { results } = await db
      .prepare(`
        SELECT v.id as vtuber_id, v.name as vtuber_name,
               t.id as tag_id, t.name as tag_name, t.category,
               vt.confidence, vt.created_at
        FROM vtuber_tags vt
        JOIN vtubers v ON vt.vtuber_id = v.id
        JOIN tags t ON vt.tag_id = t.id
        WHERE vt.is_verified = 0
        ORDER BY vt.created_at DESC
      `)
      .all();

    return c.json({ data: results });
  } catch (error) {
    console.error('Error fetching unverified tags:', error);
    return c.json({ error: 'Failed to fetch unverified tags' }, 500);
  }
});

// データベース統計取得
adminRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    const stats = {};

    // 各テーブルのレコード数
    const tables = [
      'vtubers',
      'youtube_channels',
      'twitter_accounts',
      'twitch_channels',
      'tags',
      'vtuber_tags',
      'streams',
      'news_articles',
    ];

    for (const table of tables) {
      const { results } = await db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .all();
      stats[table] = results[0]?.count || 0;
    }

    // 未承認タグ数
    const { results: unverifiedResults } = await db
      .prepare('SELECT COUNT(*) as count FROM vtuber_tags WHERE is_verified = 0')
      .all();
    stats.unverified_tags = unverifiedResults[0]?.count || 0;

    // 最終更新時刻
    const { results: lastUpdateResults } = await db
      .prepare('SELECT MAX(started_at) as last_update FROM update_logs')
      .all();
    stats.last_update = lastUpdateResults[0]?.last_update || null;

    return c.json({ data: stats });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return c.json({ error: 'Failed to fetch admin stats' }, 500);
  }
});
