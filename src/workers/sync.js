/**
 * データ同期Worker
 * Cloudflare Workers Cronで定期実行される
 */

import { YouTubeService } from '../services/youtube.js';

/**
 * YouTube情報の同期
 */
export async function syncYouTubeData(env) {
  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);
  
  let processedCount = 0;
  let errorCount = 0;
  const startTime = new Date().toISOString();

  try {
    // ログ記録開始
    const logResult = await db
      .prepare('INSERT INTO update_logs (task_type, status, started_at) VALUES (?, ?, ?)')
      .bind('youtube_sync', 'in_progress', startTime)
      .run();
    const logId = logResult.meta.last_row_id;

    // YouTubeチャンネルが登録されているVTuberを取得
    const { results: channels } = await db
      .prepare('SELECT id, vtuber_id, channel_id FROM youtube_channels')
      .all();

    console.log(`Syncing ${channels.length} YouTube channels...`);

    if (channels.length === 0) {
      await db
        .prepare(`
          UPDATE update_logs
          SET status = ?,
              records_processed = 0,
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind('success', logId)
        .run();
      return { success: true, processed: 0, errors: 0 };
    }

    // チャンネルIDを抽出
    const channelIds = channels.map(c => c.channel_id);

    // バッチで情報取得
    const channelInfos = await youtubeService.getBatchChannelInfo(channelIds);

    // データベース更新
    for (const info of channelInfos) {
      try {
        await db
          .prepare(`
            UPDATE youtube_channels
            SET channel_name = ?,
                subscriber_count = ?,
                view_count = ?,
                video_count = ?,
                custom_url = ?,
                thumbnail_url = ?,
                description = ?,
                last_synced_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE channel_id = ?
          `)
          .bind(
            info.channel_name,
            info.subscriber_count,
            info.view_count,
            info.video_count,
            info.custom_url,
            info.thumbnail_url,
            info.description,
            info.channel_id
          )
          .run();

        processedCount++;
      } catch (error) {
        console.error(`Error updating channel ${info.channel_id}:`, error);
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

    console.log(`YouTube sync completed: ${processedCount} processed, ${errorCount} errors`);
    return { success: true, processed: processedCount, errors: errorCount };
  } catch (error) {
    console.error('YouTube sync failed:', error);
    
    // エラーログ記録
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE task_type = ? AND started_at = ?
      `)
      .bind('failed', error.message, 'youtube_sync', startTime)
      .run();

    return { success: false, error: error.message };
  }
}

/**
 * Web情報の収集（基本的なスクレイピング）
 */
export async function syncWebData(env) {
  const db = env.DB;
  
  let processedCount = 0;
  let errorCount = 0;
  const startTime = new Date().toISOString();

  try {
    // ログ記録開始
    const logResult = await db
      .prepare('INSERT INTO update_logs (task_type, status, started_at) VALUES (?, ?, ?)')
      .bind('web_scraping', 'in_progress', startTime)
      .run();
    const logId = logResult.meta.last_row_id;

    // 公式サイトが登録されているVTuberを取得
    const { results: vtubers } = await db
      .prepare('SELECT id, name, official_website FROM vtubers WHERE official_website IS NOT NULL')
      .all();

    console.log(`Scraping ${vtubers.length} VTuber websites...`);

    for (const vtuber of vtubers) {
      try {
        // 基本的なHTTPリクエストでページを取得
        const response = await fetch(vtuber.official_website, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VTuberDB/1.0)',
          },
        });

        if (response.ok) {
          const html = await response.text();
          
          // 簡易的な情報抽出（タイトル、メタ情報など）
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          const descMatch = html.match(/<meta name="description" content="(.*?)"/i);
          
          const profileData = {
            title: titleMatch ? titleMatch[1] : null,
            description: descMatch ? descMatch[1] : null,
            scraped_at: new Date().toISOString(),
          };

          // web_profilesテーブルに保存
          await db
            .prepare(`
              INSERT INTO web_profiles (vtuber_id, source_url, source_type, profile_data, last_scraped_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(vtuber_id, source_url) DO UPDATE SET
                profile_data = excluded.profile_data,
                last_scraped_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            `)
            .bind(
              vtuber.id,
              vtuber.official_website,
              'official_site',
              JSON.stringify(profileData)
            )
            .run();

          processedCount++;
        }
      } catch (error) {
        console.error(`Error scraping ${vtuber.official_website}:`, error);
        errorCount++;
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
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

    console.log(`Web scraping completed: ${processedCount} processed, ${errorCount} errors`);
    return { success: true, processed: processedCount, errors: errorCount };
  } catch (error) {
    console.error('Web scraping failed:', error);
    
    // エラーログ記録
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE task_type = ? AND started_at = ?
      `)
      .bind('failed', error.message, 'web_scraping', startTime)
      .run();

    return { success: false, error: error.message };
  }
}

/**
 * すべてのデータを同期
 */
export async function syncAllData(env) {
  console.log('Starting full data sync...');
  
  const results = {
    youtube: await syncYouTubeData(env),
    web: await syncWebData(env),
  };
  
  console.log('Full data sync completed:', results);
  return results;
}
