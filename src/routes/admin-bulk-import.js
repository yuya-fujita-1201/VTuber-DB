import { Router } from 'itty-router';
import { YouTubeService } from '../services/youtube.js';

const router = Router({ base: '/api/admin/bulk-import' });

/**
 * 一括VTuber追加API
 * 
 * POST /api/admin/bulk-import/channels
 * Body: { channel_ids: string[], source: string }
 */
router.post('/channels', async (request, env) => {
  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { channel_ids, source } = await request.json();

    if (!channel_ids || !Array.isArray(channel_ids) || channel_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'channel_ids must be a non-empty array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = env.DB;
    const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

    // 既存のchannel_idを取得
    const { results: existingChannels } = await db
      .prepare('SELECT channel_id FROM youtube_channels')
      .all();
    const existingChannelIds = new Set(existingChannels.map((c) => c.channel_id));

    // 新規channel_idをフィルタリング
    const newChannelIds = channel_ids.filter((id) => !existingChannelIds.has(id));

    if (newChannelIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No new channels to import',
          total: channel_ids.length,
          new: 0,
          existing: channel_ids.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // バッチサイズ: 50件/リクエスト
    const BATCH_SIZE = 50;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < newChannelIds.length; i += BATCH_SIZE) {
      const batch = newChannelIds.slice(i, i + BATCH_SIZE);

      try {
        // YouTube APIでチャンネル情報を取得
        const channelInfos = await youtubeService.getBatchChannelInfo(batch);

        // DBに挿入
        for (const channelInfo of channelInfos) {
          try {
            // vtubers テーブルに挿入
            const vtuberResult = await db
              .prepare(`
                INSERT INTO vtubers (
                  name,
                  name_en,
                  agency_id,
                  debut_date,
                  graduation_date,
                  description,
                  sync_tier,
                  stale_level,
                  created_at,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `)
              .bind(
                channelInfo.channel_name,
                channelInfo.channel_name,
                null, // agency_id は後で設定
                null, // debut_date
                null, // graduation_date
                channelInfo.description || '',
                2, // sync_tier: A (デフォルト)
                0  // stale_level: 0 (最新)
              )
              .run();

            const vtuberId = vtuberResult.meta.last_row_id;

            // youtube_channels テーブルに挿入
            await db
              .prepare(`
                INSERT INTO youtube_channels (
                  vtuber_id,
                  channel_id,
                  channel_name,
                  custom_url,
                  subscriber_count,
                  view_count,
                  video_count,
                  thumbnail_url,
                  created_at,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `)
              .bind(
                vtuberId,
                channelInfo.channel_id,
                channelInfo.channel_name,
                channelInfo.custom_url || '',
                channelInfo.subscriber_count || 0,
                channelInfo.view_count || 0,
                channelInfo.video_count || 0,
                channelInfo.thumbnail_url || ''
              )
              .run();

            imported++;
          } catch (error) {
            console.error(`[Bulk Import] Failed to insert ${channelInfo.channel_id}:`, error);
            errors++;
          }
        }
      } catch (error) {
        console.error(`[Bulk Import] Failed to fetch batch:`, error);
        errors += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${imported} channels`,
        total: channel_ids.length,
        new: newChannelIds.length,
        existing: channel_ids.length - newChannelIds.length,
        imported,
        errors,
        source: source || 'unknown',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Bulk Import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * プロダクション別一括追加API
 * 
 * POST /api/admin/bulk-import/agencies
 * Body: { source: 'vtuber_agencies_full' }
 */
router.post('/agencies', async (request, env) => {
  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // agency_channel_ids.jsonを読み込む（Workers環境では事前にKVに保存する必要がある）
    // ここでは、リクエストボディにchannel_idsを含めることを想定
    const { channel_ids, source } = await request.json();

    if (!channel_ids || !Array.isArray(channel_ids)) {
      return new Response(
        JSON.stringify({ error: 'channel_ids must be provided as an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // /channels エンドポイントに委譲
    return await router.handle(
      new Request(new URL('/api/admin/bulk-import/channels', request.url), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ channel_ids, source: source || 'agencies' }),
      }),
      env
    );
  } catch (error) {
    console.error('[Bulk Import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

export default router;
