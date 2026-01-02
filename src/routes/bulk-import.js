import { Hono } from 'hono';
import { YouTubeService } from '../services/youtube.js';

export const bulkImportRoutes = new Hono();

/**
 * VTuberデータの一括投入
 * POST /api/bulk-import/vtubers
 * Body: { vtubers: [{ name, name_en, agency, channel_id, debut_date, ... }] }
 */
bulkImportRoutes.post('/vtubers', async (c) => {
  try {
    const { vtubers } = await c.req.json();
    
    if (!Array.isArray(vtubers) || vtubers.length === 0) {
      return c.json({ error: 'vtubers array is required' }, 400);
    }

    const db = c.env.DB;
    const youtubeService = new YouTubeService(c.env.YOUTUBE_API_KEY);
    
    const results = {
      success: [],
      failed: [],
      total: vtubers.length,
    };

    for (const vtuber of vtubers) {
      try {
        // VTuberをデータベースに挿入
        const vtuberResult = await db
          .prepare(`
            INSERT INTO vtubers (name, name_en, description, agency, debut_date, avatar_url, official_website)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            vtuber.name,
            vtuber.name_en || null,
            vtuber.description || null,
            vtuber.agency,
            vtuber.debut_date || null,
            vtuber.avatar_url || null,
            vtuber.official_website || null
          )
          .run();

        const vtuberId = vtuberResult.meta.last_row_id;

        // YouTubeチャンネル情報を取得して挿入
        if (vtuber.channel_id) {
          try {
            const channelInfo = await youtubeService.getChannelInfo(vtuber.channel_id);
            
            if (channelInfo) {
              await db
                .prepare(`
                  INSERT INTO youtube_channels (
                    vtuber_id, channel_id, channel_name, subscriber_count, 
                    view_count, video_count, custom_url, thumbnail_url, 
                    description, published_at, last_synced_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `)
                .bind(
                  vtuberId,
                  channelInfo.channel_id,
                  channelInfo.channel_name,
                  channelInfo.subscriber_count,
                  channelInfo.view_count,
                  channelInfo.video_count,
                  channelInfo.custom_url,
                  channelInfo.thumbnail_url,
                  channelInfo.description,
                  channelInfo.published_at
                )
                .run();
            }
          } catch (youtubeError) {
            console.error(`Failed to fetch YouTube data for ${vtuber.name}:`, youtubeError);
          }
        }

        results.success.push({
          name: vtuber.name,
          id: vtuberId,
        });
      } catch (error) {
        console.error(`Failed to import ${vtuber.name}:`, error);
        results.failed.push({
          name: vtuber.name,
          error: error.message,
        });
      }
    }

    return c.json({
      message: `Imported ${results.success.length} out of ${results.total} VTubers`,
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return c.json({ error: 'Failed to import VTubers' }, 500);
  }
});

/**
 * JSONファイルからの一括投入
 * POST /api/bulk-import/from-json
 * Body: { data: [{ name, name_en, agency, youtube: { channel_id, ... } }] }
 */
bulkImportRoutes.post('/from-json', async (c) => {
  try {
    const { data } = await c.req.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return c.json({ error: 'data array is required' }, 400);
    }

    const db = c.env.DB;
    
    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    for (const item of data) {
      try {
        // VTuberをデータベースに挿入
        const vtuberResult = await db
          .prepare(`
            INSERT INTO vtubers (name, name_en, description, agency, debut_date, avatar_url, official_website)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            item.name,
            item.name_en || null,
            item.description || null,
            item.agency,
            item.debut_date || null,
            item.avatar_url || null,
            item.official_website || null
          )
          .run();

        const vtuberId = vtuberResult.meta.last_row_id;

        // YouTubeチャンネル情報を挿入
        if (item.youtube) {
          await db
            .prepare(`
              INSERT INTO youtube_channels (
                vtuber_id, channel_id, channel_name, subscriber_count, 
                view_count, video_count, custom_url, thumbnail_url, 
                description, published_at, last_synced_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `)
            .bind(
              vtuberId,
              item.youtube.channel_id,
              item.youtube.channel_name,
              item.youtube.subscriber_count,
              item.youtube.view_count,
              item.youtube.video_count,
              item.youtube.custom_url || null,
              item.youtube.thumbnail_url,
              item.youtube.description || null,
              item.youtube.published_at
            )
            .run();
        }

        results.success.push({
          name: item.name,
          id: vtuberId,
        });
      } catch (error) {
        console.error(`Failed to import ${item.name}:`, error);
        results.failed.push({
          name: item.name,
          error: error.message,
        });
      }
    }

    return c.json({
      message: `Imported ${results.success.length} out of ${results.total} VTubers`,
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return c.json({ error: 'Failed to import VTubers from JSON' }, 500);
  }
});

/**
 * チャンネルIDリストからの一括投入
 * POST /api/bulk-import/from-channels
 * Body: { channels: [{ channel_id, name, name_en, agency, debut_date }] }
 */
bulkImportRoutes.post('/from-channels', async (c) => {
  try {
    const { channels } = await c.req.json();
    
    if (!Array.isArray(channels) || channels.length === 0) {
      return c.json({ error: 'channels array is required' }, 400);
    }

    const db = c.env.DB;
    const youtubeService = new YouTubeService(c.env.YOUTUBE_API_KEY);
    
    // チャンネルIDを抽出
    const channelIds = channels.map(c => c.channel_id);
    
    // YouTube APIから一括取得
    const channelInfos = await youtubeService.getBatchChannelInfo(channelIds);
    
    const results = {
      success: [],
      failed: [],
      total: channels.length,
    };

    for (const channel of channels) {
      try {
        const channelInfo = channelInfos.find(c => c.channel_id === channel.channel_id);
        
        if (!channelInfo) {
          results.failed.push({
            name: channel.name,
            error: 'Channel not found on YouTube',
          });
          continue;
        }

        // VTuberをデータベースに挿入
        const vtuberResult = await db
          .prepare(`
            INSERT INTO vtubers (name, name_en, description, agency, debut_date, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            channel.name,
            channel.name_en || null,
            channelInfo.description?.substring(0, 500) || null,
            channel.agency,
            channel.debut_date || null,
            channelInfo.thumbnail_url
          )
          .run();

        const vtuberId = vtuberResult.meta.last_row_id;

        // YouTubeチャンネル情報を挿入
        await db
          .prepare(`
            INSERT INTO youtube_channels (
              vtuber_id, channel_id, channel_name, subscriber_count, 
              view_count, video_count, custom_url, thumbnail_url, 
              description, published_at, last_synced_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .bind(
            vtuberId,
            channelInfo.channel_id,
            channelInfo.channel_name,
            channelInfo.subscriber_count,
            channelInfo.view_count,
            channelInfo.video_count,
            channelInfo.custom_url || null,
            channelInfo.thumbnail_url,
            channelInfo.description,
            channelInfo.published_at
          )
          .run();

        results.success.push({
          name: channel.name,
          id: vtuberId,
        });
      } catch (error) {
        console.error(`Failed to import ${channel.name}:`, error);
        results.failed.push({
          name: channel.name,
          error: error.message,
        });
      }
    }

    return c.json({
      message: `Imported ${results.success.length} out of ${results.total} VTubers`,
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return c.json({ error: 'Failed to import VTubers from channels' }, 500);
  }
});
