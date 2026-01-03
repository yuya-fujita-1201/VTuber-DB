import { Hono } from 'hono';

export const tagsSlugRoutes = new Hono();

// タグ詳細取得（slug）
// GET /api/tags/:slug
// 数値のみのslugは除外してidルートと衝突させない
// eslint-disable-next-line no-useless-escape
const SLUG_PATTERN = '/:slug{(?!\\d+$)[a-zA-Z0-9_-]+}';

tagsSlugRoutes.get(SLUG_PATTERN, async (c) => {
  const db = c.env.DB;
  const slug = c.req.param('slug');

  try {
    const { results: tags } = await db
      .prepare(`
        SELECT id, name, slug, description, category, parent_id
        FROM tags
        WHERE slug = ?
        LIMIT 1
      `)
      .bind(slug)
      .all();

    if (tags.length === 0) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    const tag = tags[0];
    let parent = null;

    if (tag.parent_id !== null && tag.parent_id !== undefined) {
      const { results: parents } = await db
        .prepare('SELECT id, name, slug FROM tags WHERE id = ?')
        .bind(tag.parent_id)
        .all();
      parent = parents[0] || null;
    }

    const { results: children } = await db
      .prepare('SELECT id, name, slug, parent_id FROM tags WHERE parent_id = ? ORDER BY name')
      .bind(tag.id)
      .all();

    const { results: relatedTags } = await db
      .prepare(`
        SELECT t.id, t.name, t.slug,
               tr.relation_type,
               tr.weight
        FROM tag_relations tr
        JOIN tags t ON t.id = tr.related_tag_id
        WHERE tr.tag_id = ?
        ORDER BY tr.weight DESC, t.name ASC
        LIMIT 20
      `)
      .bind(tag.id)
      .all();

    const { results: vtubers } = await db
      .prepare(`
        SELECT v.id, v.name, v.avatar_url,
               COALESCE(vt.score, vt.confidence) AS score,
               vt.confidence AS confidence
        FROM vtubers v
        JOIN vtuber_tags vt ON v.id = vt.vtuber_id
        WHERE vt.tag_id = ?
        ORDER BY score DESC, v.name ASC
      `)
      .bind(tag.id)
      .all();

    const normalizedRelated = relatedTags.map((related) => ({
      ...related,
      weight: Number(related.weight || 0),
    }));

    const normalizedVtubers = vtubers.map((vtuber) => ({
      ...vtuber,
      score: Number(vtuber.score || 0),
      confidence: Number(vtuber.confidence || 0),
    }));

    return c.json({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description || null,
        category: tag.category,
        parent: parent,
        children: children,
        related_tags: normalizedRelated,
        vtubers: normalizedVtubers,
      },
    });
  } catch (error) {
    console.error('Error fetching tag by slug:', error);
    return c.json({ error: 'Failed to fetch tag' }, 500);
  }
});
