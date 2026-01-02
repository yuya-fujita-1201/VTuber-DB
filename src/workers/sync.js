/**
 * データ同期Worker
 * Cloudflare Workers Cronで定期実行される
 */

import { YouTubeService } from '../services/youtube.js';
import { TwitterService } from '../services/twitter.js';
import { TwitchService } from '../services/twitch.js';

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
 * Twitter情報の同期
 */
export async function syncTwitterData(env) {
  const db = env.DB;
  const twitterService = new TwitterService(env.TWITTER_BEARER_TOKEN);
  
  let processedCount = 0;
  let errorCount = 0;
  const startTime = new Date().toISOString();

  try {
    // ログ記録開始
    const logResult = await db
      .prepare('INSERT INTO update_logs (task_type, status, started_at) VALUES (?, ?, ?)')
      .bind('twitter_sync', 'in_progress', startTime)
      .run();
    const logId = logResult.meta.last_row_id;

    // Twitterアカウントが登録されているVTuberを取得
    const { results: accounts } = await db
      .prepare('SELECT id, vtuber_id, username FROM twitter_accounts')
      .all();

    console.log(`Syncing ${accounts.length} Twitter accounts...`);

    // ユーザー名を抽出
    const usernames = accounts.map(a => a.username);

    // バッチで情報取得
    const userInfos = await twitterService.getBatchUsersByUsername(usernames);

    // データベース更新
    for (const info of userInfos) {
      try {
        await db
          .prepare(`
            UPDATE twitter_accounts
            SET display_name = ?,
                follower_count = ?,
                following_count = ?,
                tweet_count = ?,
                profile_image_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
          `)
          .bind(
            info.display_name,
            info.follower_count,
            info.following_count,
            info.tweet_count,
            info.profile_image_url,
            info.username
          )
          .run();

        processedCount++;
      } catch (error) {
        console.error(`Error updating account ${info.username}:`, error);
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

    console.log(`Twitter sync completed: ${processedCount} processed, ${errorCount} errors`);
    return { success: true, processed: processedCount, errors: errorCount };
  } catch (error) {
    console.error('Twitter sync failed:', error);
    
    // エラーログ記録
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE task_type = ? AND started_at = ?
      `)
      .bind('failed', error.message, 'twitter_sync', startTime)
      .run();

    return { success: false, error: error.message };
  }
}

/**
 * Twitch情報の同期
 */
export async function syncTwitchData(env) {
  const db = env.DB;
  const twitchService = new TwitchService(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET);
  
  let processedCount = 0;
  let errorCount = 0;
  const startTime = new Date().toISOString();

  try {
    // ログ記録開始
    const logResult = await db
      .prepare('INSERT INTO update_logs (task_type, status, started_at) VALUES (?, ?, ?)')
      .bind('twitch_sync', 'in_progress', startTime)
      .run();
    const logId = logResult.meta.last_row_id;

    // Twitchチャンネルが登録されているVTuberを取得
    const { results: channels } = await db
      .prepare('SELECT id, vtuber_id, channel_name FROM twitch_channels')
      .all();

    console.log(`Syncing ${channels.length} Twitch channels...`);

    // チャンネル名を抽出
    const logins = channels.map(c => c.channel_name);

    // バッチで情報取得
    const userInfos = await twitchService.getBatchUsersByLogin(logins);

    // データベース更新
    for (const info of userInfos) {
      try {
        await db
          .prepare(`
            UPDATE twitch_channels
            SET display_name = ?,
                follower_count = ?,
                view_count = ?,
                profile_image_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE channel_name = ?
          `)
          .bind(
            info.display_name,
            info.follower_count,
            info.view_count,
            info.profile_image_url,
            info.login
          )
          .run();

        processedCount++;
      } catch (error) {
        console.error(`Error updating channel ${info.login}:`, error);
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

    console.log(`Twitch sync completed: ${processedCount} processed, ${errorCount} errors`);
    return { success: true, processed: processedCount, errors: errorCount };
  } catch (error) {
    console.error('Twitch sync failed:', error);
    
    // エラーログ記録
    await db
      .prepare(`
        UPDATE update_logs
        SET status = ?,
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE task_type = ? AND started_at = ?
      `)
      .bind('failed', error.message, 'twitch_sync', startTime)
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
    twitter: await syncTwitterData(env),
    twitch: await syncTwitchData(env),
  };
  
  console.log('Full data sync completed:', results);
  return results;
}
