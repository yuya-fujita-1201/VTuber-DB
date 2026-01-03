import { Hono } from 'hono';

export const tagsTreeRoutes = new Hono();

// タグの親子構造取得
// GET /api/tags/tree
// レスポンス: { tags: [...] }
tagsTreeRoutes.get('/tree', async (c) => {
  const db = c.env.DB;

  try {
    const { results } = await db
      .prepare(`
        SELECT
          t.id,
          t.name,
          t.slug,
          t.parent_id,
          (
            SELECT COUNT(*)
            FROM tags child
            WHERE child.parent_id = t.id
          ) AS child_count,
          (
            SELECT COUNT(DISTINCT vt.vtuber_id)
            FROM vtuber_tags vt
            WHERE vt.tag_id = t.id
          ) AS vtuber_count
        FROM tags t
        ORDER BY t.parent_id, t.name
      `)
      .all();

    const tagMap = new Map();

    for (const tag of results) {
      const id = Number(tag.id);
      const parentId = tag.parent_id === null || tag.parent_id === undefined
        ? null
        : Number(tag.parent_id);

      tagMap.set(id, {
        id,
        name: tag.name,
        slug: tag.slug,
        parent_id: parentId,
        child_count: Number(tag.child_count || 0),
        vtuber_count: Number(tag.vtuber_count || 0),
        children: [],
      });
    }

    const roots = [];

    for (const tag of tagMap.values()) {
      if (tag.parent_id !== null && tagMap.has(tag.parent_id)) {
        tagMap.get(tag.parent_id).children.push(tag);
      } else {
        roots.push(tag);
      }
    }

    return c.json({ tags: roots });
  } catch (error) {
    console.error('Error fetching tag tree:', error);
    return c.json({ error: 'Failed to fetch tag tree' }, 500);
  }
});
