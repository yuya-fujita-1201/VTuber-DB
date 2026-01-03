/**
 * YouTube検索ベースの大規模VTuber収集スクリプト
 * VTuber関連のキーワードで検索し、1000〜2000件のデータを収集
 */

import { YouTubeService } from '../services/youtube.js';

// VTuber検索キーワード
const SEARCH_KEYWORDS = [
  'VTuber',
  'バーチャルYouTuber',
  'Vtuber 自己紹介',
  'Vtuber デビュー',
  'ホロライブ',
  'にじさんじ',
  'ぶいすぽ',
  'あおぎり高校',
  '774inc',
  'Re:AcT',
  'Neo-Porte',
  'VOMS',
  'VShojo',
  '.LIVE',
  'ななしいんく',
  'のりプロ',
  'すぺしゃりて',
  'GEMS COMPANY',
  'Palette Project',
  'Balus VTuber',
  'bondlive',
  'Million Production VTuber',
  'Varium',
  'VEE VTuber',
  '個人勢VTuber',
  'VTuber 歌ってみた',
  'VTuber ゲーム実況',
  'VTuber APEX',
  'VTuber マイクラ',
  'VTuber 雑談',
];

/**
 * YouTube検索でVTuberチャンネルを大量収集
 */
export async function massCollectVTubers(env, options = {}) {
  const {
    targetCount = 1000,
    batchSize = 50,
    skipExisting = true,
  } = options;

  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  console.log(`[Mass Collect] Starting mass collection (target: ${targetCount})`);

  // 既存のチャンネルIDを取得
  let existingChannelIds = new Set();
  if (skipExisting) {
    const { results } = await db
      .prepare('SELECT channel_id FROM youtube_channels')
      .all();
    existingChannelIds = new Set(results.map(r => r.channel_id));
  }

  const collectedChannelIds = new Set();
  let totalCollected = 0;
  let totalErrors = 0;

  // 各キーワードで検索
  for (const keyword of SEARCH_KEYWORDS) {
    if (totalCollected >= targetCount) {
      break;
    }

    console.log(`[Mass Collect] Searching for: ${keyword}`);

    try {
      // YouTube検索（最大50件）
      const channels = await youtubeService.searchChannels(keyword, 50);

      // 新規チャンネルのみフィルタ
      const newChannels = channels.filter(
        ch => !existingChannelIds.has(ch.channel_id) && !collectedChannelIds.has(ch.channel_id)
      );

      if (newChannels.length === 0) {
        console.log(`[Mass Collect] No new channels found for: ${keyword}`);
        continue;
      }

      console.log(`[Mass Collect] Found ${newChannels.length} new channels for: ${keyword}`);

      // チャンネルIDを収集
      const channelIds = newChannels.map(ch => ch.channel_id);

      // 詳細情報を一括取得
      const channelsInfo = await youtubeService.getBatchChannelInfo(channelIds);

      // DBに保存
      for (const channelInfo of channelsInfo) {
        if (totalCollected >= targetCount) {
          break;
        }

        try {
          // VTuberを作成
          const vtuberResult = await db
            .prepare(`
              INSERT INTO vtubers (name, name_en, avatar_url, sync_tier, description)
              VALUES (?, ?, ?, ?, ?)
            `)
            .bind(
              channelInfo.channel_name,
              channelInfo.custom_url || channelInfo.channel_name,
              channelInfo.thumbnail_url,
              3, // デフォルトはTier 3（低頻度更新）
              channelInfo.description?.substring(0, 500) || null
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

          // initial_sync_channelジョブをenqueue（優先度低め）
          await db
            .prepare(`
              INSERT INTO jobs (job_type, payload, priority)
              VALUES (?, ?, ?)
            `)
            .bind(
              'initial_sync_channel',
              JSON.stringify({ vtuber_id: vtuberId, channel_id: channelInfo.channel_id }),
              3
            )
            .run();

          collectedChannelIds.add(channelInfo.channel_id);
          totalCollected++;

          console.log(`[Mass Collect] Collected: ${channelInfo.channel_name} (${totalCollected}/${targetCount})`);
        } catch (error) {
          console.error(`[Mass Collect] Error collecting ${channelInfo.channel_name}:`, error);
          totalErrors++;
        }
      }

      // レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Mass Collect] Error searching for ${keyword}:`, error);
      totalErrors++;
    }
  }

  console.log(`[Mass Collect] Completed: ${totalCollected} collected, ${totalErrors} errors`);

  return {
    collected: totalCollected,
    errors: totalErrors,
    keywords_used: SEARCH_KEYWORDS.length,
  };
}

/**
 * 登録者数でフィルタリングして収集
 */
export async function collectBySubscriberCount(env, options = {}) {
  const {
    minSubscribers = 1000,
    maxSubscribers = 1000000,
    targetCount = 500,
  } = options;

  const db = env.DB;
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  console.log(`[Collect by Subscribers] Target: ${minSubscribers}-${maxSubscribers} subscribers`);

  // 既存のチャンネルIDを取得
  const { results: existing } = await db
    .prepare('SELECT channel_id FROM youtube_channels')
    .all();
  const existingChannelIds = new Set(existing.map(r => r.channel_id));

  const collectedChannelIds = new Set();
  let totalCollected = 0;

  // VTuber関連キーワードで検索
  for (const keyword of ['VTuber', 'バーチャルYouTuber', '個人勢VTuber']) {
    if (totalCollected >= targetCount) {
      break;
    }

    const channels = await youtubeService.searchChannels(keyword, 50);
    const channelIds = channels
      .filter(ch => !existingChannelIds.has(ch.channel_id) && !collectedChannelIds.has(ch.channel_id))
      .map(ch => ch.channel_id);

    if (channelIds.length === 0) continue;

    const channelsInfo = await youtubeService.getBatchChannelInfo(channelIds);

    // 登録者数でフィルタ
    const filteredChannels = channelsInfo.filter(
      ch => ch.subscriber_count >= minSubscribers && ch.subscriber_count <= maxSubscribers
    );

    for (const channelInfo of filteredChannels) {
      if (totalCollected >= targetCount) break;

      try {
        const vtuberResult = await db
          .prepare(`
            INSERT INTO vtubers (name, name_en, avatar_url, sync_tier)
            VALUES (?, ?, ?, ?)
          `)
          .bind(
            channelInfo.channel_name,
            channelInfo.custom_url || channelInfo.channel_name,
            channelInfo.thumbnail_url,
            channelInfo.subscriber_count >= 100000 ? 1 : channelInfo.subscriber_count >= 10000 ? 2 : 3
          )
          .run();

        const vtuberId = vtuberResult.meta.last_row_id;

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

        collectedChannelIds.add(channelInfo.channel_id);
        totalCollected++;

        console.log(`[Collect by Subscribers] Collected: ${channelInfo.channel_name} (${channelInfo.subscriber_count} subs)`);
      } catch (error) {
        console.error(`[Collect by Subscribers] Error:`, error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { collected: totalCollected };
}
