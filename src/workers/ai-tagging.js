/**
 * AIタグづけWorker
 * VTuberに対してAIによる自動タグづけを実行
 */

import { AITaggerService } from '../services/ai-tagger.js';

/**
 * 全VTuberに対してAIタグづけを実行
 * @param {Object} env - 環境変数
 * @param {number} limit - 処理する最大件数（デフォルト: 100）
 * @returns {Promise<Object>} 実行結果
 */
export async function runAITagging(env, limit = 100) {
  const db = env.DB;
  const aiTagger = new AITaggerService(env.OPENAI_API_KEY);
  
  let processedCount = 0;
  let errorCount = 0;
  let totalTagsAdded = 0;
  const startTime = new Date().toISOString();

  try {
    // ログ記録開始
    const logResult = await db
      .prepare('INSERT INTO update_logs (task_type, status, started_at) VALUES (?, ?, ?)')
      .bind('ai_tagging', 'in_progress', startTime)
      .run();
    const logId = logResult.meta.last_row_id;

    // タグが少ない、または未タグのVTuberを優先的に取得
    const { results: vtubers } = await db
      .prepare(`
        SELECT v.*, 
               y.subscriber_count as youtube_subscribers,
               t.follower_count as twitter_followers,
               COUNT(vt.tag_id) as tag_count
        FROM vtubers v
        LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
        LEFT JOIN twitter_accounts t ON v.id = t.vtuber_id
        LEFT JOIN vtuber_tags vt ON v.id = vt.vtuber_id
        GROUP BY v.id
        ORDER BY tag_count ASC, y.subscriber_count DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    console.log(`AI tagging ${vtubers.length} VTubers...`);

    // 利用可能なタグ一覧を取得
    const { results: availableTags } = await db
      .prepare('SELECT * FROM tags ORDER BY category, name')
      .all();

    console.log(`Available tags: ${availableTags.length}`);

    // 各VTuberに対してタグづけ
    for (const vtuber of vtubers) {
      try {
        console.log(`Tagging VTuber: ${vtuber.name} (ID: ${vtuber.id})`);

        // AIでタグを生成
        const suggestedTags = await aiTagger.generateTags(vtuber, availableTags);

        console.log(`Generated ${suggestedTags.length} tags for ${vtuber.name}`);

        // タグをデータベースに保存
        for (const tag of suggestedTags) {
          try {
            await db
              .prepare(`
                INSERT OR REPLACE INTO vtuber_tags (vtuber_id, tag_id, confidence, is_verified)
                VALUES (?, ?, ?, 0)
              `)
              .bind(vtuber.id, tag.tag_id, tag.confidence)
              .run();

            totalTagsAdded++;
          } catch (error) {
            console.error(`Error saving tag ${tag.tag_name} for ${vtuber.name}:`, error);
          }
        }

        processedCount++;

        // レート制限対策（1秒待機）
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error tagging VTuber ${vtuber.id}:`, error);
        errorCount++;
      }
    }

    // ログ更新
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            records_processed = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind('success', processedCount, logId)
      .run();

    console.log(`AI tagging completed: ${processedCount} VTubers processed, ${totalTagsAdded} tags added, ${errorCount} errors`);
    
    return {
      success: true,
      processed: processedCount,
      tags_added: totalTagsAdded,
      errors: errorCount,
    };
  } catch (error) {
    console.error('AI tagging failed:', error);
    
    // エラーログ記録
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE task_type = ? AND started_at = ?
      `)
      .bind('failed', error.message, 'ai_tagging', startTime)
      .run();

    return { success: false, error: error.message };
  }
}

/**
 * 特定のVTuberに対してAIタグづけを実行
 * @param {Object} env - 環境変数
 * @param {number} vtuberId - VTuber ID
 * @returns {Promise<Object>} 実行結果
 */
export async function runAITaggingForVTuber(env, vtuberId) {
  const db = env.DB;
  const aiTagger = new AITaggerService(env.OPENAI_API_KEY);

  try {
    // VTuber情報を取得
    const { results: vtubers } = await db
      .prepare(`
        SELECT v.*, 
               y.subscriber_count as youtube_subscribers,
               t.follower_count as twitter_followers
        FROM vtubers v
        LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
        LEFT JOIN twitter_accounts t ON v.id = t.vtuber_id
        WHERE v.id = ?
      `)
      .bind(vtuberId)
      .all();

    if (vtubers.length === 0) {
      throw new Error('VTuber not found');
    }

    const vtuber = vtubers[0];

    // 利用可能なタグ一覧を取得
    const { results: availableTags } = await db
      .prepare('SELECT * FROM tags ORDER BY category, name')
      .all();

    // AIでタグを生成
    const suggestedTags = await aiTagger.generateTags(vtuber, availableTags);

    // タグをデータベースに保存
    let tagsAdded = 0;
    for (const tag of suggestedTags) {
      await db
        .prepare(`
          INSERT OR REPLACE INTO vtuber_tags (vtuber_id, tag_id, confidence, is_verified)
          VALUES (?, ?, ?, 0)
        `)
        .bind(vtuberId, tag.tag_id, tag.confidence)
        .run();

      tagsAdded++;
    }

    return {
      success: true,
      vtuber_id: vtuberId,
      tags_added: tagsAdded,
      tags: suggestedTags,
    };
  } catch (error) {
    console.error(`Error tagging VTuber ${vtuberId}:`, error);
    return {
      success: false,
      vtuber_id: vtuberId,
      error: error.message,
    };
  }
}

/**
 * タグの再評価を実行
 * @param {Object} env - 環境変数
 * @param {number} vtuberId - VTuber ID
 * @returns {Promise<Object>} 実行結果
 */
export async function reevaluateVTuberTags(env, vtuberId) {
  const db = env.DB;
  const aiTagger = new AITaggerService(env.OPENAI_API_KEY);

  try {
    // VTuber情報を取得
    const { results: vtubers } = await db
      .prepare(`
        SELECT v.*, 
               y.subscriber_count as youtube_subscribers,
               t.follower_count as twitter_followers
        FROM vtubers v
        LEFT JOIN youtube_channels y ON v.id = y.vtuber_id
        LEFT JOIN twitter_accounts t ON v.id = t.vtuber_id
        WHERE v.id = ?
      `)
      .bind(vtuberId)
      .all();

    if (vtubers.length === 0) {
      throw new Error('VTuber not found');
    }

    const vtuber = vtubers[0];

    // 現在のタグを取得
    const { results: currentTags } = await db
      .prepare(`
        SELECT t.* FROM tags t
        JOIN vtuber_tags vt ON t.id = vt.tag_id
        WHERE vt.vtuber_id = ?
      `)
      .bind(vtuberId)
      .all();

    // 利用可能なタグ一覧を取得
    const { results: availableTags } = await db
      .prepare('SELECT * FROM tags ORDER BY category, name')
      .all();

    // AIでタグを再評価
    const evaluation = await aiTagger.reevaluateTags(vtuber, currentTags, availableTags);

    return {
      success: true,
      vtuber_id: vtuberId,
      evaluation: evaluation,
    };
  } catch (error) {
    console.error(`Error reevaluating tags for VTuber ${vtuberId}:`, error);
    return {
      success: false,
      vtuber_id: vtuberId,
      error: error.message,
    };
  }
}
