import { Hono } from 'hono';

export const tagRoutes = new Hono();

// タグ一覧取得
tagRoutes.get('/', async (c) => {
  const db = c.env.DB;
  const { category } = c.req.query();

  try {
    let query = 'SELECT * FROM tags';
    const params = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const { results } = await db.prepare(query).bind(...params).all();

    // カテゴリ別にグループ化
    const grouped = results.reduce((acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    }, {});

    return c.json({
      data: results,
      grouped: grouped,
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// タグ詳細取得（このタグを持つVTuber一覧）
tagRoutes.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    // タグ情報
    const { results: tags } = await db
      .prepare('SELECT * FROM tags WHERE id = ?')
      .bind(id)
      .all();

    if (tags.length === 0) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // このタグを持つVTuber一覧
    const { results: vtubers } = await db
      .prepare(`
        SELECT v.*, vt.confidence, vt.is_verified,
               y.subscriber_count as youtube_subscribers
        FROM vtubers v
        JOIN vtuber_tags vt ON v.id = vt.vtuber_id
        LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
        WHERE vt.tag_id = ?
        ORDER BY y.subscriber_count DESC
      `)
      .bind(id)
      .all();

    return c.json({
      tag: tags[0],
      vtubers: vtubers,
      count: vtubers.length,
    });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return c.json({ error: 'Failed to fetch tag' }, 500);
  }
});

// タグ作成（管理者用）
tagRoutes.post('/', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { name, category, description } = data;

    const result = await db
      .prepare('INSERT INTO tags (name, category, description) VALUES (?, ?, ?)')
      .bind(name, category, description || null)
      .run();

    return c.json({
      id: result.meta.last_row_id,
      message: 'Tag created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating tag:', error);
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

// タグ更新（管理者用）
tagRoutes.put('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const data = await c.req.json();

  try {
    const { name, category, description } = data;

    await db
      .prepare('UPDATE tags SET name = ?, category = ?, description = ? WHERE id = ?')
      .bind(name, category, description || null, id)
      .run();

    return c.json({ message: 'Tag updated successfully' });
  } catch (error) {
    console.error('Error updating tag:', error);
    return c.json({ error: 'Failed to update tag' }, 500);
  }
});

// タグ削除（管理者用）
tagRoutes.delete('/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
    return c.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return c.json({ error: 'Failed to delete tag' }, 500);
  }
});

// VTuberにタグを追加
tagRoutes.post('/assign', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { vtuber_id, tag_id, confidence = 1.0, is_verified = 0 } = data;

    await db
      .prepare(`
        INSERT OR REPLACE INTO vtuber_tags (vtuber_id, tag_id, confidence, is_verified)
        VALUES (?, ?, ?, ?)
      `)
      .bind(vtuber_id, tag_id, confidence, is_verified)
      .run();

    return c.json({ message: 'Tag assigned successfully' }, 201);
  } catch (error) {
    console.error('Error assigning tag:', error);
    return c.json({ error: 'Failed to assign tag' }, 500);
  }
});

// VTuberからタグを削除
tagRoutes.delete('/assign', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { vtuber_id, tag_id } = data;

    await db
      .prepare('DELETE FROM vtuber_tags WHERE vtuber_id = ? AND tag_id = ?')
      .bind(vtuber_id, tag_id)
      .run();

    return c.json({ message: 'Tag unassigned successfully' });
  } catch (error) {
    console.error('Error unassigning tag:', error);
    return c.json({ error: 'Failed to unassign tag' }, 500);
  }
});

// タグの承認状態を更新
tagRoutes.put('/verify', async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();

  try {
    const { vtuber_id, tag_id, is_verified } = data;

    await db
      .prepare('UPDATE vtuber_tags SET is_verified = ? WHERE vtuber_id = ? AND tag_id = ?')
      .bind(is_verified, vtuber_id, tag_id)
      .run();

    return c.json({ message: 'Tag verification updated successfully' });
  } catch (error) {
    console.error('Error updating tag verification:', error);
    return c.json({ error: 'Failed to update tag verification' }, 500);
  }
});
