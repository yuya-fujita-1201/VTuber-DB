import { Hono } from 'hono';
import { batchCollectVTubers } from '../scripts/batch-collect-vtubers.js';
import { massCollectVTubers } from '../scripts/mass-collect-vtubers.js';

export const adminBatchRoutes = new Hono();

// バッチ収集を実行
// POST /api/admin/batch-collect
// body: { limit: 50, agency: "hololive" (optional) }
adminBatchRoutes.post('/batch-collect', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 50, agency = null } = body;

    const result = await batchCollectVTubers(c.env, {
      limit,
      agency,
      skipExisting: true,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.collected}件のVTuberを収集しました`,
    });
  } catch (error) {
    console.error('Error in batch collect:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// 事務所一覧を取得
// GET /api/admin/agencies
adminBatchRoutes.get('/agencies', async (c) => {
  try {
    const agenciesData = await import('../../data/vtuber_agencies.json', {
      assert: { type: 'json' },
    });

    const agencies = agenciesData.default.agencies.map(a => ({
      name: a.name,
      name_en: a.name_en,
      channel_count: a.channels.length,
    }));

    return c.json({ agencies });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return c.json({ error: 'Failed to fetch agencies' }, 500);
  }
});

// 収集統計を取得
// GET /api/admin/collection-stats
adminBatchRoutes.get('/collection-stats', async (c) => {
  const db = c.env.DB;

  try {
    const { results: totalVTubers } = await db
      .prepare('SELECT COUNT(*) as count FROM vtubers')
      .all();

    const { results: withYouTube } = await db
      .prepare('SELECT COUNT(*) as count FROM youtube_channels')
      .all();

    const { results: withTags } = await db
      .prepare('SELECT COUNT(DISTINCT vtuber_id) as count FROM vtuber_tags')
      .all();

    const { results: byAgency } = await db
      .prepare(`
        SELECT agency, COUNT(*) as count
        FROM vtubers
        WHERE agency IS NOT NULL
        GROUP BY agency
        ORDER BY count DESC
      `)
      .all();

    return c.json({
      total_vtubers: totalVTubers[0].count,
      with_youtube: withYouTube[0].count,
      with_tags: withTags[0].count,
      by_agency: byAgency,
    });
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// AIタグ付けを一括実行
// POST /api/admin/batch-tag
// body: { limit: 10, vtuber_ids: [1, 2, 3] (optional) }
adminBatchRoutes.post('/batch-tag', async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json();
    const { limit = 10, vtuber_ids = null } = body;

    let vtubers = [];

    if (vtuber_ids && Array.isArray(vtuber_ids)) {
      // 指定されたVTuberのみ
      const placeholders = vtuber_ids.map(() => '?').join(',');
      const { results } = await db
        .prepare(`SELECT id FROM vtubers WHERE id IN (${placeholders})`)
        .bind(...vtuber_ids)
        .all();
      vtubers = results;
    } else {
      // タグが未設定のVTuberを取得
      const { results } = await db
        .prepare(`
          SELECT v.id
          FROM vtubers v
          LEFT JOIN vtuber_tags vt ON v.id = vt.vtuber_id
          WHERE vt.vtuber_id IS NULL
          LIMIT ?
        `)
        .bind(limit)
        .all();
      vtubers = results;
    }

    let queued = 0;

    for (const vtuber of vtubers) {
      await db
        .prepare(`
          INSERT INTO jobs (job_type, payload, priority)
          VALUES (?, ?, ?)
        `)
        .bind(
          'ai_tagging_vtuber',
          JSON.stringify({ vtuber_id: vtuber.id }),
          7
        )
        .run();
      queued++;
    }

    return c.json({
      success: true,
      queued,
      message: `${queued}件のAIタグ付けジョブをキューに追加しました`,
    });
  } catch (error) {
    console.error('Error in batch tag:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// 大規模収集を実行（YouTube検索ベース）
// POST /api/admin/mass-collect
// body: { targetCount: 1000, order: 'relevance' }
adminBatchRoutes.post('/mass-collect', async (c) => {
  try {
    const body = await c.req.json();
    const { targetCount = 1000, order = 'relevance' } = body;

    // 最大2000件まで
    const safeTargetCount = Math.min(targetCount, 2000);

    const result = await massCollectVTubers(c.env, {
      targetCount: safeTargetCount,
      batchSize: 50,
      skipExisting: true,
      order: order,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.collected}件のVTuberを収集しました（${result.keywords_used}キーワード使用）`,
    });
  } catch (error) {
    console.error('Error in mass collect:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});
