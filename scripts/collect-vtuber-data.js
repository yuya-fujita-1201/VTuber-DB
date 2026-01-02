/**
 * VTuberデータ収集スクリプト
 * YouTube Data API v3を使用してVTuberチャンネル情報を収集
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

if (!YOUTUBE_API_KEY) {
  console.error('Error: YOUTUBE_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * YouTube APIからチャンネル情報を取得
 */
async function getChannelInfo(channelId) {
  const url = `${API_BASE_URL}/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Channel not found');
    }
    
    const channel = data.items[0];
    
    return {
      channel_id: channel.id,
      channel_name: channel.snippet.title,
      description: channel.snippet.description,
      custom_url: channel.snippet.customUrl || null,
      subscriber_count: parseInt(channel.statistics.subscriberCount) || 0,
      video_count: parseInt(channel.statistics.videoCount) || 0,
      view_count: parseInt(channel.statistics.viewCount) || 0,
      thumbnail_url: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
      published_at: channel.snippet.publishedAt,
    };
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error.message);
    return null;
  }
}

/**
 * バッチでチャンネル情報を取得
 */
async function getBatchChannelInfo(channelIds) {
  const results = [];
  const batchSize = 50; // YouTube APIの制限
  
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize);
    const ids = batch.join(',');
    const url = `${API_BASE_URL}/channels?part=snippet,statistics,brandingSettings&id=${ids}&key=${YOUTUBE_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.error('API Error:', data.error.message);
        continue;
      }
      
      if (data.items) {
        for (const channel of data.items) {
          results.push({
            channel_id: channel.id,
            channel_name: channel.snippet.title,
            description: channel.snippet.description,
            custom_url: channel.snippet.customUrl || null,
            subscriber_count: parseInt(channel.statistics.subscriberCount) || 0,
            video_count: parseInt(channel.statistics.videoCount) || 0,
            view_count: parseInt(channel.statistics.viewCount) || 0,
            thumbnail_url: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
            published_at: channel.snippet.publishedAt,
          });
        }
      }
      
      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error fetching batch:', error.message);
    }
  }
  
  return results;
}

/**
 * チャンネル検索
 */
async function searchChannels(query, maxResults = 50) {
  const url = `${API_BASE_URL}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    if (!data.items) {
      return [];
    }
    
    const channelIds = data.items.map(item => item.snippet.channelId);
    return await getBatchChannelInfo(channelIds);
  } catch (error) {
    console.error(`Error searching channels for "${query}":`, error.message);
    return [];
  }
}

/**
 * VTuberチャンネルリストからデータを収集
 */
async function collectVTuberData(channelList) {
  console.log(`Collecting data for ${channelList.length} VTubers...`);
  
  const channelIds = channelList.map(v => v.channel_id);
  const channelInfos = await getBatchChannelInfo(channelIds);
  
  // チャンネル情報とVTuber情報をマージ
  const vtuberData = [];
  
  for (const vtuber of channelList) {
    const channelInfo = channelInfos.find(c => c.channel_id === vtuber.channel_id);
    
    if (channelInfo) {
      vtuberData.push({
        name: vtuber.name,
        name_en: vtuber.name_en || null,
        description: vtuber.description || channelInfo.description.substring(0, 500),
        agency: vtuber.agency,
        debut_date: vtuber.debut_date || null,
        official_website: vtuber.official_website || null,
        avatar_url: vtuber.avatar_url || channelInfo.thumbnail_url,
        youtube: channelInfo,
      });
    }
  }
  
  return vtuberData;
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getChannelInfo,
    getBatchChannelInfo,
    searchChannels,
    collectVTuberData,
  };
}

// CLIとして実行された場合
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'search') {
    const query = args[1];
    if (!query) {
      console.error('Usage: node collect-vtuber-data.js search <query>');
      process.exit(1);
    }
    
    searchChannels(query, 50).then(results => {
      console.log(`Found ${results.length} channels:`);
      console.log(JSON.stringify(results, null, 2));
    });
  } else if (command === 'channel') {
    const channelId = args[1];
    if (!channelId) {
      console.error('Usage: node collect-vtuber-data.js channel <channel_id>');
      process.exit(1);
    }
    
    getChannelInfo(channelId).then(result => {
      if (result) {
        console.log(JSON.stringify(result, null, 2));
      }
    });
  } else if (command === 'collect') {
    const inputFile = args[1] || 'vtuber-list.json';
    const outputFile = args[2] || 'vtuber-data.json';
    
    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file ${inputFile} not found`);
      process.exit(1);
    }
    
    const channelList = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    
    collectVTuberData(channelList).then(data => {
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
      console.log(`Collected data for ${data.length} VTubers`);
      console.log(`Output saved to ${outputFile}`);
    });
  } else {
    console.log('Usage:');
    console.log('  node collect-vtuber-data.js search <query>');
    console.log('  node collect-vtuber-data.js channel <channel_id>');
    console.log('  node collect-vtuber-data.js collect [input_file] [output_file]');
  }
}
