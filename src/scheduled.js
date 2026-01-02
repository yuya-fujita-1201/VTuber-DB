/**
 * Cloudflare Workers Cron Triggers
 * 定期実行タスク
 */

import { syncYouTubeData, syncTwitterData, syncTwitchData } from './workers/sync.js';
import { runAITagging } from './workers/ai-tagging.js';

export async function handleScheduled(event, env, ctx) {
  console.log('Running scheduled tasks at:', new Date().toISOString());

  const hour = new Date().getUTCHours();

  try {
    // 6時間ごとにYouTube同期（0, 6, 12, 18時）
    if (hour % 6 === 0) {
      console.log('Running YouTube sync...');
      await syncYouTubeData(env);
    }

    // 12時間ごとにTwitter同期（0, 12時）
    if (hour % 12 === 0) {
      console.log('Running Twitter sync...');
      await syncTwitterData(env);
    }

    // 12時間ごとにTwitch同期（0, 12時）
    if (hour % 12 === 0) {
      console.log('Running Twitch sync...');
      await syncTwitchData(env);
    }

    // 毎日0時にAIタグづけ（最大50件）
    if (hour === 0) {
      console.log('Running AI tagging...');
      await runAITagging(env, 50);
    }

    console.log('Scheduled tasks completed successfully');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
}
