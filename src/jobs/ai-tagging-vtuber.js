import { AITaggerService } from '../services/ai-tagger.js';
import { getTableColumns, pickColumn } from './job-utils.js';

function buildEvidencePayload(vtuber, recentContents, tag) {
  return {
    reason: tag.reason || '',
    vtuber: {
      name: vtuber.name,
      description: vtuber.description || null,
      agency: vtuber.agency || null,
    },
    youtube: {
      channel_name: vtuber.youtube_channel_name || null,
      subscriber_count: vtuber.youtube_subscribers || null,
    },
    recent_videos: recentContents.map(video => ({
      title: video.title,
      published_at: video.published_at,
    })),
  };
}

export async function aiTaggingVtuberJob(env, payload) {
  const db = env.DB;
  const { vtuber_id } = payload || {};

  if (!vtuber_id) {
    throw new Error('Missing vtuber_id in payload');
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const aiTagger = new AITaggerService(env.OPENAI_API_KEY);

  const { results: vtubers } = await db
    .prepare(`
      SELECT v.*, 
             y.channel_name as youtube_channel_name,
             y.subscriber_count as youtube_subscribers,
             t.follower_count as twitter_followers
      FROM vtubers v
      LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
      LEFT JOIN twitter_accounts t ON v.id = t.vtuber_id
      WHERE v.id = ?
    `)
    .bind(vtuber_id)
    .all();

  if (vtubers.length === 0) {
    throw new Error('VTuber not found');
  }

  const vtuber = vtubers[0];

  let recentContents = [];
  try {
    const { results } = await db
      .prepare(`
        SELECT title, description, published_at
        FROM youtube_contents
        WHERE vtuber_id = ?
        ORDER BY published_at DESC
        LIMIT 5
      `)
      .bind(vtuber_id)
      .all();
    recentContents = results;
  } catch (error) {
    console.warn('Failed to load recent contents for evidence:', error);
  }

  const { results: availableTags } = await db
    .prepare('SELECT * FROM tags ORDER BY category, name')
    .all();

  const suggestedTags = await aiTagger.generateTags(vtuber, availableTags);

  const evidenceColumns = await getTableColumns(db, 'vtuber_tag_evidence');
  const evidenceField = pickColumn(evidenceColumns, ['evidence', 'evidence_text', 'evidence_json', 'reason']);
  const sourceField = pickColumn(evidenceColumns, ['source_type', 'evidence_type', 'source']);
  const vtuberTagsColumns = await getTableColumns(db, 'vtuber_tags');
  const hasEvidenceCount = vtuberTagsColumns.includes('evidence_count');

  let tagsAdded = 0;

  for (const tag of suggestedTags) {
    await db
      .prepare(`
        INSERT INTO vtuber_tags (vtuber_id, tag_id, score, confidence, is_verified)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(vtuber_id, tag_id) DO UPDATE SET
          score = excluded.score,
          confidence = excluded.confidence
      `)
      .bind(vtuber_id, tag.tag_id, tag.confidence, tag.confidence)
      .run();

    if (evidenceColumns.length > 0) {
      const evidencePayload = buildEvidencePayload(vtuber, recentContents, tag);
      const evidenceValue = evidenceField === 'evidence_json'
        ? JSON.stringify(evidencePayload)
        : JSON.stringify(evidencePayload);

      await db
        .prepare('DELETE FROM vtuber_tag_evidence WHERE vtuber_id = ? AND tag_id = ?')
        .bind(vtuber_id, tag.tag_id)
        .run();

      const columns = ['vtuber_id', 'tag_id'];
      const values = [vtuber_id, tag.tag_id];

      if (sourceField) {
        columns.push(sourceField);
        values.push('ai_tagging');
      }

      if (evidenceField) {
        columns.push(evidenceField);
        values.push(evidenceValue);
      }

      const placeholders = columns.map(() => '?').join(', ');
      await db
        .prepare(`
          INSERT INTO vtuber_tag_evidence (${columns.join(', ')})
          VALUES (${placeholders})
        `)
        .bind(...values)
        .run();

      if (hasEvidenceCount) {
        try {
          await db
            .prepare(`
              UPDATE vtuber_tags
              SET evidence_count = (
                SELECT COUNT(*) FROM vtuber_tag_evidence
                WHERE vtuber_id = ? AND tag_id = ?
              )
              WHERE vtuber_id = ? AND tag_id = ?
            `)
            .bind(vtuber_id, tag.tag_id, vtuber_id, tag.tag_id)
            .run();
        } catch (error) {
          console.warn('Failed to update evidence_count:', error);
        }
      }
    }

    tagsAdded++;
  }

  return {
    vtuber_id,
    tags_added: tagsAdded,
    tags: suggestedTags,
  };
}
