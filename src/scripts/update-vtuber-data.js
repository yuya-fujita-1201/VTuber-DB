/**
 * VTuberデータの更新スクリプト
 * 既存VTuberの登録者数、視聴回数、動画数を定期的に更新
 */

import { YouTubeService } from '../services/youtube.js';

/**
 * stale_levelを計算
 * @param {string} lastSyncedAt - 最終同期日時
 * @returns {number} stale_level (0: 新鮮, 1: やや古い, 2: 古い, 3: 非常に古い)
 */
function calculateStaleLevel(lastSyncedAt) {
  if (!lastSyncedAt) return 3;
  
  const now = new Date();
  const lastSync = new Date(lastSyncedAt);
  const daysSinceSync = (now - lastSync) / (1000 * 60 * 60 * 24);
  
  if (daysSinceSync < 7) return 0;      // 1週間以内: 新鮮
  if (daysSinceSync < 30) return 1;     // 1ヶ月以内: やや古い
  if (daysSinceSync < 90) return 2;     // 3ヶ月以内: 古い
  return 3;                              // 3ヶ月以上: 非常に古い
}

/**
 * sync_tierを計算
 * @param {number} subscriberCount - 登録者数
 * @returns {string} sync_tier (S, A, B, C)
 */
function calculateSyncTier(subscriberCount) {
  if (subscriberCount >= 1000000) return 'S';  // 100万人以上
  if (subscriberCount >= 500000) return 'A';   // 50万人以上
  if (subscriberCount >= 100000) return 'B';   // 10万人以上
  return 'C';                                   // 10万人未満
}

/**
 * 古いデータを持つVTuberを優先的に更新
 */
export async function updateStaleVTubers(env, options = {}) {
  const {
    limit = 50,  // 更新するVTuber数
    minStaleLevel = 1,  // 最小stale_level（1以上を更新）
  } = options;

  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  console.log(`[Update Stale] Starting: ${limit} VTubers with stale_level >= ${minStaleLevel}`);

  // stale_levelが高いVTuberを取得
  const results = await db.prepare(`
    SELECT id, channel_id, channel_name, stale_level, last_synced_at
    FROM vtubers
    WHERE channel_id IS NOT NULL
      AND (stale_level >= ? OR stale_level IS NULL)
    ORDER BY 
      CASE 
        WHEN stale_level IS NULL THEN 999
        ELSE stale_level
      END DESC,
      last_synced_at ASC NULLS FIRST
    LIMIT ?
  `).bind(minStaleLevel, limit).all();

  if (!results.results || results.results.length === 0) {
    console.log('[Update Stale] No stale VTubers found');
    return { updated: 0, errors: 0 };
  }

  let totalUpdated = 0;
  let totalErrors = 0;

  // チャンネルIDを50件ずつバッチ処理
  const channelIds = results.results.map(v => v.channel_id);
  
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    
    try {
      console.log(`[Update Stale] Fetching batch ${Math.floor(i / 50) + 1}...`);
      
      const channels = await youtubeService.getBatchChannelInfo(batch);
      
      // 取得したチャンネル情報でDBを更新
      for (const channel of channels) {
        const vtuber = results.results.find(v => v.channel_id === channel.channel_id);
        if (!vtuber) continue;
        
        const syncTier = calculateSyncTier(channel.subscriber_count);
        const staleLevel = 0; // 更新直後なので新鮮
        
        await db.prepare(`
          UPDATE vtubers
          SET 
            subscriber_count = ?,
            view_count = ?,
            video_count = ?,
            sync_tier = ?,
            stale_level = ?,
            last_synced_at = datetime('now')
          WHERE id = ?
        `).bind(
          channel.subscriber_count,
          channel.view_count,
          channel.video_count,
          syncTier,
          staleLevel,
          vtuber.id
        ).run();
        
        totalUpdated++;
      }
      
      console.log(`[Update Stale] Updated ${channels.length} VTubers in batch ${Math.floor(i / 50) + 1}`);
      
      // API呼び出し間隔を確保（レート制限対策）
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`[Update Stale] Error in batch ${Math.floor(i / 50) + 1}:`, error);
      
      // クォータ超過時は即座に停止
      if (error.message && (error.message.includes('403') || error.message.includes('quotaExceeded'))) {
        console.error('[Update Stale] Quota exceeded. Stopping update.');
        break;
      }
      
      totalErrors++;
    }
  }

  console.log(`[Update Stale] Completed: ${totalUpdated} VTubers updated, ${totalErrors} errors`);

  return {
    updated: totalUpdated,
    errors: totalErrors,
    processed: results.results.length,
  };
}

/**
 * すべてのVTuberのstale_levelを再計算
 */
export async function recalculateStaleLevel(env) {
  const db = env.DB;

  console.log('[Recalculate Stale] Starting...');

  // すべてのVTuberを取得
  const results = await db.prepare(`
    SELECT id, last_synced_at
    FROM vtubers
  `).all();

  if (!results.results || results.results.length === 0) {
    console.log('[Recalculate Stale] No VTubers found');
    return { updated: 0 };
  }

  let totalUpdated = 0;

  for (const vtuber of results.results) {
    const staleLevel = calculateStaleLevel(vtuber.last_synced_at);
    
    await db.prepare(`
      UPDATE vtubers
      SET stale_level = ?
      WHERE id = ?
    `).bind(staleLevel, vtuber.id).run();
    
    totalUpdated++;
  }

  console.log(`[Recalculate Stale] Completed: ${totalUpdated} VTubers updated`);

  return {
    updated: totalUpdated,
  };
}

/**
 * Tierごとに更新頻度を変える
 * S Tier: 毎日更新
 * A Tier: 週1回更新
 * B Tier: 月1回更新
 * C Tier: 3ヶ月に1回更新
 */
export async function updateByTier(env, tier) {
  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  // Tierごとの更新間隔（日数）
  const updateIntervals = {
    'S': 1,    // 毎日
    'A': 7,    // 週1回
    'B': 30,   // 月1回
    'C': 90,   // 3ヶ月に1回
  };

  const interval = updateIntervals[tier] || 30;

  console.log(`[Update By Tier] Starting: Tier ${tier} (interval: ${interval} days)`);

  // 最終更新から指定日数以上経過したVTuberを取得
  const results = await db.prepare(`
    SELECT id, channel_id, channel_name
    FROM vtubers
    WHERE sync_tier = ?
      AND channel_id IS NOT NULL
      AND (
        last_synced_at IS NULL
        OR julianday('now') - julianday(last_synced_at) >= ?
      )
    LIMIT 50
  `).bind(tier, interval).all();

  if (!results.results || results.results.length === 0) {
    console.log(`[Update By Tier] No Tier ${tier} VTubers need update`);
    return { updated: 0, errors: 0 };
  }

  let totalUpdated = 0;
  let totalErrors = 0;

  // チャンネルIDを50件ずつバッチ処理
  const channelIds = results.results.map(v => v.channel_id);
  
  try {
    console.log(`[Update By Tier] Fetching ${channelIds.length} Tier ${tier} VTubers...`);
    
    const channels = await youtubeService.getBatchChannelInfo(channelIds);
    
    // 取得したチャンネル情報でDBを更新
    for (const channel of channels) {
      const vtuber = results.results.find(v => v.channel_id === channel.channel_id);
      if (!vtuber) continue;
      
      const syncTier = calculateSyncTier(channel.subscriber_count);
      const staleLevel = 0; // 更新直後なので新鮮
      
      await db.prepare(`
        UPDATE vtubers
        SET 
          subscriber_count = ?,
          view_count = ?,
          video_count = ?,
          sync_tier = ?,
          stale_level = ?,
          last_synced_at = datetime('now')
        WHERE id = ?
      `).bind(
        channel.subscriber_count,
        channel.view_count,
        channel.video_count,
        syncTier,
        staleLevel,
        vtuber.id
      ).run();
      
      totalUpdated++;
    }
    
    console.log(`[Update By Tier] Updated ${channels.length} Tier ${tier} VTubers`);
    
  } catch (error) {
    console.error(`[Update By Tier] Error for Tier ${tier}:`, error);
    totalErrors++;
  }

  console.log(`[Update By Tier] Completed: ${totalUpdated} VTubers updated, ${totalErrors} errors`);

  return {
    updated: totalUpdated,
    errors: totalErrors,
    tier,
  };
}
