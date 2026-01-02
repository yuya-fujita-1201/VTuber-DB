import { Hono } from 'hono';

export const vtuberRoutes = new Hono();

// VTuber一覧取得
vtuberRoutes.get('/', async (c) => {
  const db = c.env.DB;
  const { limit = 50, offset = 0, agency, sort = 'name' } = c.req.query();

  try {
    let query = `
      SELECT 
        v.*,
        y.subscriber_count as youtube_subscribers,
        t.follower_count as twitter_followers,
        tw.follower_count as twitch_followers
      FROM vtubers v
      LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
      LEFT JOIN twitter_accounts t ON v.id = t.vtuber_id
      LEFT JOIN twitch_channels tw ON v.id = tw.vtuber_id
    `;

    const conditions = [];
    const params = [];

    if (agency) {
      conditions.push('v.agency = ?');
      params.push(agency);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // ソート
    switch (sort) {
      case 'subscribers':
        query += ' ORDER BY y.subscriber_count DESC';
        break;
      case 'followers':
        query += ' ORDER BY t.follower_count DESC';
        break;
      case 'debut':
        query += ' ORDER BY v.debut_date DESC';
        break;
      default:
        query += ' ORDER BY v.name ASC';
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await db.prepare(query).bind(...params).all();

    // 総数取得
    let countQuery = 'SELECT COUNT(*) as total FROM vtubers v';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const { results: countResults } = await db.prepare(countQuery).bind(...params.slice(0, -2)).all();
    const total = countResults[0]?.total || 0;

    return c.json({
      data: results,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Error fetching vtubers:', error);
    return c.json({ error: 'Failed to fetch vtubers' }, 500);
  }
});

// VTuber詳細取得
vtuberRoutes.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    // 基本情報
    const { results: vtubers } = await db
      .prepare('SELECT * FROM vtubers WHERE id = ?')
      .bind(id)
      .all();

    if (vtubers.length === 0) {
      return c.json({ error: 'VTuber not found' }, 404);
    }

    const vtuber = vtubers[0];

    // YouTube情報
    const { results: youtube } = await db
      .prepare('SELECT * FROM youtube_channels WHERE vtuber_id = ?')
      .bind(id)
      .all();

    // Twitter情報
    const { results: twitter } = await db
      .prepare('SELECT * FROM twitter_accounts WHERE vtuber_id = ?')
      .bind(id)
      .all();

    // Twitch情報
    const { results: twitch } = await db
      .prepare('SELECT * FROM twitch_channels WHERE vtuber_id = ?')
      .bind(id)
      .all();

    // タグ情報
    const { results: tags } = await db
      .prepare(`
        SELECT t.*, vt.confidence, vt.is_verified
        FROM tags t
        JOIN vtuber_tags vt ON t.id = vt.tag_id
        WHERE vt.vtuber_id = ?
        ORDER BY t.category, t.name
      `)
      .bind(id)
      .all();

    // 最近の配信情報
    const { results: streams } = await db
      .prepare(`
        SELECT * FROM streams
        WHERE vtuber_id = ?
        ORDER BY scheduled_start_time DESC
        LIMIT 10
      `)
      .bind(id)
      .all();

    return c.json({
      ...vtuber,
      youtube: youtube[0] || null,
      twitter: twitter[0] || null,
      twitch: twitch[0] || null,
      tags: tags,
      recent_streams: streams,
    });
  } catch (error) {
    console.error('Error fetching vtuber:', error);
    return c.json({ error: 'Failed to fetch vtuber' }, 500);
  }
});

// VTuber作成（管理者用）
vtuberRoutes.post('/', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { name, name_en, description, agency, debut_date, avatar_url } = data;

    const result = await db
      .prepare(`
        INSERT INTO vtubers (name, name_en, description, agency, debut_date, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(name, name_en || null, description || null, agency || null, debut_date || null, avatar_url || null)
      .run();

    return c.json({
      id: result.meta.last_row_id,
      message: 'VTuber created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating vtuber:', error);
    return c.json({ error: 'Failed to create vtuber' }, 500);
  }
});

// VTuber更新（管理者用）
vtuberRoutes.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const data = await c.req.json();

  try {
    const { name, name_en, description, agency, debut_date, avatar_url } = data;

    await db
      .prepare(`
        UPDATE vtubers
        SET name = ?, name_en = ?, description = ?, agency = ?, debut_date = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(name, name_en || null, description || null, agency || null, debut_date || null, avatar_url || null, id)
      .run();

    return c.json({ message: 'VTuber updated successfully' });
  } catch (error) {
    console.error('Error updating vtuber:', error);
    return c.json({ error: 'Failed to update vtuber' }, 500);
  }
});

// VTuber削除（管理者用）
vtuberRoutes.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    await db.prepare('DELETE FROM vtubers WHERE id = ?').bind(id).run();
    return c.json({ message: 'VTuber deleted successfully' });
  } catch (error) {
    console.error('Error deleting vtuber:', error);
    return c.json({ error: 'Failed to delete vtuber' }, 500);
  }
});
