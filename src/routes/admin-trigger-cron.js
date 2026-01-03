/**
 * 管理者用: Cron Triggerを即時実行するテストAPI
 */

import weeklyCollect from '../cron/weekly-collect.js';
import dailyUpdate from '../cron/daily-update.js';
import dailyMaintenance from '../cron/daily-maintenance.js';

export default {
  /**
   * POST /api/admin/trigger-cron
   * Cron Triggerを即時実行
   */
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 認証チェック（テストモードではスキップ）
    const testMode = request.headers.get('X-Test-Mode') === 'true';
    if (!testMode) {
      const adminToken = request.headers.get('X-Admin-Token');
      if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    try {
      const { type } = await request.json();

      console.log(`[admin-trigger-cron] Triggering cron: ${type}`);

      let result;
      switch (type) {
        case 'weekly-collect':
          result = await weeklyCollect(env);
          break;
        case 'daily-update':
          result = await dailyUpdate(env);
          break;
        case 'daily-maintenance':
          result = await dailyMaintenance(env);
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid cron type' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
      }

      console.log(`[admin-trigger-cron] Cron ${type} completed:`, result);

      return new Response(
        JSON.stringify({
          success: true,
          type,
          result,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[admin-trigger-cron] Error:', error);
      return new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
