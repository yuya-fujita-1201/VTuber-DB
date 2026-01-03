/**
 * Cloudflare Workers Cron Triggers
 * 定期実行タスク
 * 
 * スケジュール:
 * - 週次データ収集: 毎週日曜日 0:00 (JST 9:00)
 * - 日次データ更新: 毎日 2:00 (JST 11:00)
 * - 日次メンテナンス: 毎日 4:00 (JST 13:00)
 */

import { syncYouTubeData, syncWebData } from './workers/sync.js';
import { runAITagging } from './workers/ai-tagging.js';
import { weeklyCollect } from './cron/weekly-collect.js';
import { dailyUpdate } from './cron/daily-update.js';
import { dailyMaintenance } from './cron/daily-maintenance.js';

export async function handleScheduled(event, env, ctx) {
  console.log('[Scheduled] Running scheduled tasks at:', new Date().toISOString());

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const hour = now.getUTCHours();

  try {
    // 週次データ収集: 毎週日曜日 0:00 (JST 9:00)
    if (dayOfWeek === 0 && hour === 0) {
      console.log('[Scheduled] Running weekly collect');
      const result = await weeklyCollect(env);
      console.log('[Scheduled] Weekly collect result:', result);
    }

    // 日次データ更新: 毎日 2:00 (JST 11:00)
    if (hour === 2) {
      console.log('[Scheduled] Running daily update');
      const result = await dailyUpdate(env);
      console.log('[Scheduled] Daily update result:', result);
    }

    // 日次メンテナンス: 毎日 4:00 (JST 13:00)
    if (hour === 4) {
      console.log('[Scheduled] Running daily maintenance');
      const result = await dailyMaintenance(env);
      console.log('[Scheduled] Daily maintenance result:', result);
    }

    // 旧スケジュール（互換性のため保持）
    // 6時間ごとにYouTube同期（0, 6, 12, 18時）
    if (hour % 6 === 0 && hour !== 0 && hour !== 2 && hour !== 4) {
      console.log('[Scheduled] Running YouTube sync (legacy)...');
      await syncYouTubeData(env);
    }

    // 12時間ごとにWebスクレイピング（0, 12時）
    if (hour % 12 === 0 && hour !== 0 && hour !== 2 && hour !== 4) {
      console.log('[Scheduled] Running web scraping (legacy)...');
      await syncWebData(env);
    }

    // 毎日0時にAIタグづけ（最大50件）
    if (hour === 0 && dayOfWeek !== 0) {
      console.log('[Scheduled] Running AI tagging (legacy)...');
      await runAITagging(env, 50);
    }

    console.log('[Scheduled] Scheduled tasks completed successfully');
  } catch (error) {
    console.error('[Scheduled] Error in scheduled tasks:', error);
  }
}
