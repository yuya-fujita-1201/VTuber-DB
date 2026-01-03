/**
 * YouTube Data API v3統合サービス
 */

export class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
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
      
    } catch (error) {
      console.error(error);
    }
  }
}
