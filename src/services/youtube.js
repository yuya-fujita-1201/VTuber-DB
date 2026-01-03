/**
 * YouTube Data API v3統合サービス
 */

export class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  /**
   * チャンネル情報を取得
   * @param {string} channelId - YouTubeチャンネルID
   * @returns {Promise<Object>} チャンネル情報
   */
  async getChannelInfo(channelId) {
    try {
      const url = `${this.baseUrl}/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Channel not found');
      }

      const channel = data.items[0];
      
      return {
        channel_id: channel.id,
        channel_name: channel.snippet.title,
        description: channel.snippet.description,
        custom_url: channel.snippet.customUrl || null,
        thumbnail_url: channel.snippet.thumbnails?.high?.url || null,
        subscriber_count: parseInt(channel.statistics.subscriberCount || 0),
        view_count: parseInt(channel.statistics.viewCount || 0),
        video_count: parseInt(channel.statistics.videoCount || 0),
        published_at: channel.snippet.publishedAt,
      };
    } catch (error) {
      console.error('Error fetching YouTube channel:', error);
      throw error;
    }
  }

  /**
   * チャンネル名で検索
   * @param {string} query - 検索クエリ
   * @param {number} maxResults - 最大結果数
   * @param {string} order - 検索結果の並び順（relevance, date, viewCount）
   * @returns {Promise<Array>} チャンネル一覧
   */
  async searchChannels(query, maxResults, order) {
    maxResults = maxResults || 10;
    order = order || 'relevance';
    try {
      const url = `${this.baseUrl}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}&order=${order}&key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.items.map(item => ({
        channel_id: item.snippet.channelId,
        channel_name: item.snippet.title,
        description: item.snippet.description,
        thumbnail_url: item.snippet.thumbnails?.high?.url || null,
      }));
    } catch (error) {
      console.error('Error searching YouTube channels:', error);
      throw error;
    }
  }

  /**
   * 複数のチャンネル情報を一括取得
   * @param {Array<string>} channelIds - チャンネルIDの配列
   * @returns {Promise<Array>} チャンネル情報の配列
   */
  async getBatchChannelInfo(channelIds) {
    try {
      const results = [];
      // YouTube APIは最大50件まで一度に取得可能
      const chunkSize = 50;
      
      for (let i = 0; i < channelIds.length; i += chunkSize) {
        const chunk = channelIds.slice(i, i + chunkSize);
        const ids = chunk.join(',');
        
        const url = `${this.baseUrl}/channels?part=snippet,statistics&id=${ids}&key=${this.apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        
        for (const channel of data.items) {
          results.push({
            channel_id: channel.id,
            channel_name: channel.snippet.title,
            custom_url: channel.snippet.customUrl || null,
            thumbnail_url: channel.snippet.thumbnails?.high?.url || null,
            subscriber_count: parseInt(channel.statistics.subscriberCount || 0),
            view_count: parseInt(channel.statistics.viewCount || 0),
            video_count: parseInt(channel.statistics.videoCount || 0),
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching batch YouTube channels:', error);
      throw error;
    }
  }

  /**
   * チャンネルの最新動画を取得
   * @param {string} channelId - YouTubeチャンネルID
   * @param {number} maxResults - 最大結果数
   * @returns {Promise<Array>} 動画一覧
   */
  async getLatestVideos(channelId, maxResults) {
    maxResults = maxResults || 10;
    try {
      const url = `${this.baseUrl}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.items.map(item => ({
        video_id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        published_at: item.snippet.publishedAt,
        thumbnail_url: item.snippet.thumbnails?.high?.url || null,
      }));
    } catch (error) {
      console.error('Error fetching latest videos:', error);
      throw error;
    }
  }

  /**
   * ライブ配信情報を取得
   * @param {string} channelId - YouTubeチャンネルID
   * @returns {Promise<Array>} ライブ配信一覧
   */
  async getLiveStreams(channelId) {
    try {
      const url = `${this.baseUrl}/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.items.map(item => ({
        video_id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        scheduled_start_time: item.snippet.publishedAt,
        thumbnail_url: item.snippet.thumbnails?.high?.url || null,
        stream_url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
    } catch (error) {
      console.error('Error fetching live streams:', error);
      throw error;
    }
  }

  /**
   * 予定されている配信を取得
   * @param {string} channelId - YouTubeチャンネルID
   * @returns {Promise<Array>} 予定配信一覧
   */
  async getUpcomingStreams(channelId) {
    try {
      const url = `${this.baseUrl}/search?part=snippet&channelId=${channelId}&eventType=upcoming&type=video&key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.items.map(item => ({
        video_id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        scheduled_start_time: item.snippet.publishedAt,
        thumbnail_url: item.snippet.thumbnails?.high?.url || null,
        stream_url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
    } catch (error) {
      console.error('Error fetching upcoming streams:', error);
      throw error;
    }
  }

  /**
   * チャンネルの動画を詳細情報付きで取得
   * @param {string} channelId - YouTubeチャンネルID
   * @param {number} maxResults - 最大結果数
   * @returns {Promise<Array>} 動画詳細情報の配列
   */
  async getChannelVideos(channelId, maxResults) {
    maxResults = maxResults || 5;
    try {
      // ステップ1: 動画IDを取得
      const searchUrl = `${this.baseUrl}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${this.apiKey}`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        return [];
      }

      const videoIds = searchData.items.map(item => item.id.videoId).join(',');

      // ステップ2: 動画の詳細情報を取得
      const videosUrl = `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${this.apiKey}`;
      const videosResponse = await fetch(videosUrl);
      
      if (!videosResponse.ok) {
        throw new Error(`YouTube API error: ${videosResponse.status}`);
      }

      const videosData = await videosResponse.json();
      
      return videosData.items.map(item => ({
        video_id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        published_at: item.snippet.publishedAt,
        view_count: parseInt(item.statistics.viewCount || 0),
        like_count: parseInt(item.statistics.likeCount || 0),
        comment_count: parseInt(item.statistics.commentCount || 0),
        duration: item.contentDetails.duration,
        thumbnail_url: item.snippet.thumbnails?.high?.url || null,
      }));
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      throw error;
    }
  }
}
