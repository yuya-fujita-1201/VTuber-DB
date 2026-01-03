/**
 * 空テーブルの充填スクリプト
 * youtube_contents、vtuber_tag_evidence、tag_relationsなどの空テーブルにデータを充填
 */

import { YouTubeService } from '../services/youtube.js';

/**
 * 既存のVTuberの動画データを収集
 */
export async function fillYouTubeContents(env, options = {}) {
  const {
    limit = 10,  // 処理するVTuber数
    videosPerChannel = 5,  // 1チャンネルあたりの動画数
  } = options;

  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  console.log(`[Fill Contents] Starting: ${limit} VTubers, ${videosPerChannel} videos each`);

  // youtube_contentsが空のVTuberを取得
  const results = await db.prepare(`
    SELECT v.id, v.channel_id, v.channel_name
    FROM vtubers v
    WHERE v.channel_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM youtube_contents yc
        WHERE yc.vtuber_id = v.id
      )
    LIMIT ?
  `).bind(limit).all();

  if (!results.results || results.results.length === 0) {
    console.log('[Fill Contents] No VTubers found without contents');
    return { collected: 0, errors: 0 };
  }

  let totalCollected = 0;
  let totalErrors = 0;

  for (const vtuber of results.results) {
    try {
      console.log(`[Fill Contents] Fetching videos for: ${vtuber.channel_name}`);

      // チャンネルの動画を取得
      const videos = await youtubeService.getChannelVideos(vtuber.channel_id, videosPerChannel);

      if (videos.length === 0) {
        console.log(`[Fill Contents] No videos found for: ${vtuber.channel_name}`);
        continue;
      }

      // youtube_contentsに挿入
      for (const video of videos) {
        await db.prepare(`
          INSERT INTO youtube_contents (
            vtuber_id,
            video_id,
            title,
            description,
            published_at,
            view_count,
            like_count,
            comment_count,
            duration,
            thumbnail_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(video_id) DO UPDATE SET
            view_count = excluded.view_count,
            like_count = excluded.like_count,
            comment_count = excluded.comment_count
        `).bind(
          vtuber.id,
          video.video_id,
          video.title,
          video.description,
          video.published_at,
          video.view_count,
          video.like_count,
          video.comment_count,
          video.duration,
          video.thumbnail_url
        ).run();

        totalCollected++;
      }

      console.log(`[Fill Contents] Collected ${videos.length} videos for: ${vtuber.channel_name}`);

      // API呼び出し間隔を確保（レート制限対策）
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[Fill Contents] Error for ${vtuber.channel_name}:`, error);
      
      // クォータ超過時は即座に停止
      if (error.message && (error.message.includes('403') || error.message.includes('quotaExceeded'))) {
        console.error('[Fill Contents] Quota exceeded. Stopping collection.');
        break;
      }
      
      totalErrors++;
    }
  }

  console.log(`[Fill Contents] Completed: ${totalCollected} videos collected, ${totalErrors} errors`);

  return {
    collected: totalCollected,
    errors: totalErrors,
    vtubers_processed: results.results.length,
  };
}

/**
 * タグ関連度を計算
 */
export async function calculateTagRelations(env, options = {}) {
  const {
    minCooccurrence = 3,  // 最小共起回数
  } = options;

  const db = env.DB;

  console.log('[Tag Relations] Starting calculation...');

  // 既存の関連度を削除
  await db.prepare('DELETE FROM tag_relations').run();

  // 共起タグを計算（同じVTuberに付けられているタグのペア）
  const cooccurrenceQuery = `
    INSERT INTO tag_relations (tag_id, related_tag_id, relation_type, weight, created_at)
    SELECT 
      vt1.tag_id,
      vt2.tag_id AS related_tag_id,
      'cooccurrence' AS relation_type,
      CAST(COUNT(*) AS REAL) / (
        SELECT COUNT(DISTINCT vtuber_id) FROM vtuber_tags WHERE tag_id = vt1.tag_id
      ) AS weight,
      datetime('now') AS created_at
    FROM vtuber_tags vt1
    JOIN vtuber_tags vt2 ON vt1.vtuber_id = vt2.vtuber_id AND vt1.tag_id < vt2.tag_id
    GROUP BY vt1.tag_id, vt2.tag_id
    HAVING COUNT(*) >= ?
  `;

  const cooccurrenceResult = await db.prepare(cooccurrenceQuery).bind(minCooccurrence).run();
  const cooccurrenceCount = cooccurrenceResult.meta.changes || 0;

  console.log(`[Tag Relations] Calculated ${cooccurrenceCount} cooccurrence relations`);

  // 兄弟タグを計算（同じ親を持つタグ）
  const siblingQuery = `
    INSERT INTO tag_relations (tag_id, related_tag_id, relation_type, weight, created_at)
    SELECT 
      t1.id AS tag_id,
      t2.id AS related_tag_id,
      'sibling' AS relation_type,
      0.7 AS weight,
      datetime('now') AS created_at
    FROM tags t1
    JOIN tags t2 ON t1.parent_id = t2.parent_id AND t1.id < t2.id
    WHERE t1.parent_id IS NOT NULL
  `;

  const siblingResult = await db.prepare(siblingQuery).run();
  const siblingCount = siblingResult.meta.changes || 0;

  console.log(`[Tag Relations] Calculated ${siblingCount} sibling relations`);

  const totalRelations = cooccurrenceCount + siblingCount;

  console.log(`[Tag Relations] Completed: ${totalRelations} relations calculated`);

  return {
    cooccurrence: cooccurrenceCount,
    sibling: siblingCount,
    total: totalRelations,
  };
}

/**
 * タグ根拠を自動生成（動画データから）
 */
export async function generateTagEvidence(env, options = {}) {
  const {
    limit = 50,  // 処理するVTuber数
  } = options;

  const db = env.DB;

  console.log(`[Tag Evidence] Starting: ${limit} VTubers`);

  // タグはあるが根拠がないVTuberを取得
  const results = await db.prepare(`
    SELECT DISTINCT vt.vtuber_id, vt.tag_id, v.channel_name, t.name AS tag_name
    FROM vtuber_tags vt
    JOIN vtubers v ON vt.vtuber_id = v.id
    JOIN tags t ON vt.tag_id = t.id
    WHERE NOT EXISTS (
      SELECT 1 FROM vtuber_tag_evidence vte
      WHERE vte.vtuber_id = vt.vtuber_id AND vte.tag_id = vt.tag_id
    )
    LIMIT ?
  `).bind(limit).all();

  if (!results.results || results.results.length === 0) {
    console.log('[Tag Evidence] No VTuber-tag pairs found without evidence');
    return { generated: 0 };
  }

  let totalGenerated = 0;

  for (const row of results.results) {
    try {
      // 動画データからタグに関連する動画を検索
      const videos = await db.prepare(`
        SELECT video_id, title, description
        FROM youtube_contents
        WHERE vtuber_id = ?
          AND (
            title LIKE '%' || ? || '%'
            OR description LIKE '%' || ? || '%'
          )
        LIMIT 3
      `).bind(row.vtuber_id, row.tag_name, row.tag_name).all();

      if (!videos.results || videos.results.length === 0) {
        // 動画が見つからない場合はデフォルトの根拠を生成
        await db.prepare(`
          INSERT INTO vtuber_tag_evidence (
            vtuber_id,
            tag_id,
            platform,
            evidence_type,
            snippet,
            weight,
            created_at
          ) VALUES (?, ?, 'manual', 'default', 'タグが手動で設定されました', 0.5, datetime('now'))
        `).bind(row.vtuber_id, row.tag_id).run();

        totalGenerated++;
        continue;
      }

      // 動画から根拠を生成
      for (const video of videos.results) {
        const snippet = video.title.substring(0, 200);
        
        await db.prepare(`
          INSERT INTO vtuber_tag_evidence (
            vtuber_id,
            tag_id,
            platform,
            content_id,
            evidence_type,
            snippet,
            weight,
            created_at
          ) VALUES (?, ?, 'youtube', ?, 'title', ?, 0.8, datetime('now'))
        `).bind(row.vtuber_id, row.tag_id, video.video_id, snippet).run();

        totalGenerated++;
      }

      console.log(`[Tag Evidence] Generated evidence for: ${row.channel_name} - ${row.tag_name}`);

    } catch (error) {
      console.error(`[Tag Evidence] Error for ${row.channel_name}:`, error);
    }
  }

  console.log(`[Tag Evidence] Completed: ${totalGenerated} evidence generated`);

  return {
    generated: totalGenerated,
    pairs_processed: results.results.length,
  };
}
