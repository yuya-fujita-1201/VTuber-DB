import { Hono } from 'hono';

export const searchRoutes = new Hono();

// 高度な検索
searchRoutes.get('/', async (c) => {
  const db = c.env.DB;
  const {
    q, // 検索キーワード
    keyword, // 検索キーワード（別名）
    tags, // タグID（カンマ区切り）
    agency,
    min_subscribers,
    max_subscribers,
    sort = 'relevance',
    limit = 50,
    offset = 0,
  } = c.req.query();

  // keywordパラメータもサポート
  const searchKeyword = q || keyword;

  try {
    let query = `
      SELECT DISTINCT
        v.*,
        y.subscriber_count as youtube_subscribers
      FROM vtubers v
      LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
    `;

    const conditions = [];
    const params = [];

    // タグ検索
    if (tags) {
      const tagIds = tags.split(',').map(id => parseInt(id));
      query += `
        JOIN vtuber_tags vt ON v.id = vt.vtuber_id
      `;
      conditions.push(`vt.tag_id IN (${tagIds.map(() => '?').join(',')})`);
      params.push(...tagIds);
    }

    // キーワード検索
    if (searchKeyword) {
      conditions.push('(v.name LIKE ? OR v.name_en LIKE ? OR v.description LIKE ?)');
      const searchTerm = `%${searchKeyword}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 所属事務所フィルター
    if (agency) {
      conditions.push('v.agency = ?');
      params.push(agency);
    }

    // YouTube登録者数フィルター
    if (min_subscribers) {
      conditions.push('y.subscriber_count >= ?');
      params.push(parseInt(min_subscribers));
    }
    if (max_subscribers) {
      conditions.push('y.subscriber_count <= ?');
      params.push(parseInt(max_subscribers));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // ソート
    switch (sort) {
      case 'subscribers':
        query += ' ORDER BY y.subscriber_count DESC';
        break;
      case 'debut':
        query += ' ORDER BY v.debut_date DESC';
        break;
      case 'name':
        query += ' ORDER BY v.name ASC';
        break;
      default:
        // relevance: キーワード検索時は名前の一致度、それ以外は登録者数
        if (searchKeyword) {
          query += ' ORDER BY v.name ASC';
        } else {
          query += ' ORDER BY y.subscriber_count DESC';
        }
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all();

    return c.json({
      data: results,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: results.length,
      },
    });
  } catch (error) {
    console.error('Error searching vtubers:', error);
    return c.json({ error: 'Failed to search vtubers', message: error.message }, 500);
  }
});

// 所属事務所一覧取得
searchRoutes.get('/agencies', async (c) => {
  const db = c.env.DB;

  try {
    const { results } = await db
      .prepare(`
        SELECT DISTINCT agency, COUNT(*) as count
        FROM vtubers
        WHERE agency IS NOT NULL
        GROUP BY agency
        ORDER BY count DESC
      `)
      .all();

    return c.json({ data: results });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return c.json({ error: 'Failed to fetch agencies' }, 500);
  }
});

// 統計情報取得
searchRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    // 総VTuber数
    const { results: totalResults } = await db
      .prepare('SELECT COUNT(*) as total FROM vtubers')
      .all();

    // 所属事務所数
    const { results: agencyResults } = await db
      .prepare('SELECT COUNT(DISTINCT agency) as total FROM vtubers WHERE agency IS NOT NULL')
      .all();

    // 総YouTube登録者数
    const { results: subscriberResults } = await db
      .prepare('SELECT SUM(subscriber_count) as total FROM youtube_channels')
      .all();

    // タグ数
    const { results: tagResults } = await db
      .prepare('SELECT COUNT(*) as total FROM tags')
      .all();

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
