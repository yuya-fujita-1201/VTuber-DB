/**
 * VTuberバッチ収集スクリプト
 * 事務所のチャンネルリストから一括でVTuberを収集
 */

import { YouTubeService } from '../services/youtube.js';
import agenciesData from '../../data/vtuber_agencies.json' assert { type: 'json' };

export async function batchCollectVTubers(env, options = {}) {
  const {
    limit = 50,
    agency = null,
    skipExisting = true,
  } = options;

  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);
  
  console.log(`[Batch Collect] Starting collection (limit: ${limit}, agency: ${agency || 'all'})`);

  // 収集対象のチャンネルIDを取得
  let channelIds = [];
  
  if (agency) {
    const agencyData = agenciesData.agencies.find(a => a.name_en === agency || a.name === agency);
    if (!agencyData) {
      throw new Error(`Agency not found: ${agency}`);
    }
    channelIds = agencyData.channels;
  } else {
    // すべての事務所から収集
    for (const agencyData of agenciesData.agencies) {
      channelIds.push(...agencyData.channels);
    }
  }

  // 既存のチャンネルIDを取得
  let existingChannelIds = new Set();
  if (skipExisting) {
    const { results } = await db
      .prepare('SELECT channel_id FROM youtube_channels')
      .all();
    existingChannelIds = new Set(results.map(r => r.channel_id));
  }

  // 未登録のチャンネルIDをフィルタ
  const newChannelIds = channelIds.filter(id => !existingChannelIds.has(id)).slice(0, limit);

  if (newChannelIds.length === 0) {
    console.log('[Batch Collect] No new channels to collect');
    return { collected: 0, skipped: channelIds.length };
  }

  console.log(`[Batch Collect] Found ${newChannelIds.length} new channels`);

  // チャンネル情報を一括取得
  const channelsInfo = await youtubeService.getBatchChannelInfo(newChannelIds);

  let collected = 0;
  let errors = 0;

  for (const channelInfo of channelsInfo) {
    try {
      // VTuberを作成
      const vtuberResult = await db
        .prepare(`
          INSERT INTO vtubers (name, name_en, avatar_url, sync_tier)
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          channelInfo.channel_name,
          channelInfo.custom_url || channelInfo.channel_name,
          channelInfo.thumbnail_url,
          2 // デフォルトはTier 2
        )
        .run();

      const vtuberId = vtuberResult.meta.last_row_id;

      // YouTubeチャンネル情報を保存
      await db
        .prepare(`
          INSERT INTO youtube_channels (vtuber_id, channel_id, channel_name, subscriber_count, view_count, video_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          vtuberId,
          channelInfo.channel_id,
          channelInfo.channel_name,
          channelInfo.subscriber_count,
          channelInfo.view_count,
          channelInfo.video_count
        )
        .run();

      // 事務所情報を設定
      const agencyData = agenciesData.agencies.find(a => a.channels.includes(channelInfo.channel_id));
      if (agencyData) {
        await db
          .prepare('UPDATE vtubers SET agency = ? WHERE id = ?')
          .bind(agencyData.name, vtuberId)
          .run();
      }

      // initial_sync_channelジョブをenqueue
      await db
        .prepare(`
          INSERT INTO jobs (job_type, payload, priority)
          VALUES (?, ?, ?)
        `)
        .bind(
          'initial_sync_channel',
          JSON.stringify({ vtuber_id: vtuberId, channel_id: channelInfo.channel_id }),
          5
        )
        .run();

      collected++;
      console.log(`[Batch Collect] Collected: ${channelInfo.channel_name} (${vtuberId})`);
    } catch (error) {
      console.error(`[Batch Collect] Error collecting ${channelInfo.channel_name}:`, error);
      errors++;
    }
  }

  console.log(`[Batch Collect] Completed: ${collected} collected, ${errors} errors`);

  return {
    collected,
    errors,
    skipped: channelIds.length - newChannelIds.length,
  };
}
