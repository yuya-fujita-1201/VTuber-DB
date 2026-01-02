/**
 * Twitch API統合サービス
 */

export class TwitchService {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = 'https://api.twitch.tv/helix';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * アクセストークンを取得
   * @returns {Promise<string>} アクセストークン
   */
  async getAccessToken() {
    // トークンがまだ有効な場合は再利用
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const url = `https://id.twitch.tv/oauth2/token?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`;
      const response = await fetch(url, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Twitch OAuth error: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // トークンの有効期限を設定（少し余裕を持たせる）
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting Twitch access token:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報を取得
   * @param {string} login - Twitchユーザー名
   * @returns {Promise<Object>} ユーザー情報
   */
  async getUserByLogin(login) {
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/users?login=${login}`;
      const response = await fetch(url, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('User not found');
      }

      const user = data.data[0];
      
      // フォロワー数を取得
      const followerCount = await this.getFollowerCount(user.id);
      
      return {
        user_id: user.id,
        login: user.login,
        display_name: user.display_name,
        description: user.description || null,
        profile_image_url: user.profile_image_url || null,
        view_count: parseInt(user.view_count || 0),
        follower_count: followerCount,
        created_at: user.created_at,
      };
    } catch (error) {
      console.error('Error fetching Twitch user:', error);
      throw error;
    }
  }

  /**
   * フォロワー数を取得
   * @param {string} userId - TwitchユーザーID
   * @returns {Promise<number>} フォロワー数
   */
  async getFollowerCount(userId) {
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/channels/followers?broadcaster_id=${userId}&first=1`;
      const response = await fetch(url, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.total || 0;
    } catch (error) {
      console.error('Error fetching Twitch follower count:', error);
      return 0;
    }
  }

  /**
   * 複数のユーザー情報を一括取得
   * @param {Array<string>} logins - ユーザー名の配列
   * @returns {Promise<Array>} ユーザー情報の配列
   */
  async getBatchUsersByLogin(logins) {
    try {
      const token = await this.getAccessToken();
      const results = [];
      // Twitch APIは最大100件まで一度に取得可能
      const chunkSize = 100;
      
      for (let i = 0; i < logins.length; i += chunkSize) {
        const chunk = logins.slice(i, i + chunkSize);
        const loginsParam = chunk.map(l => `login=${l}`).join('&');
        
        const url = `${this.baseUrl}/users?${loginsParam}`;
        const response = await fetch(url, {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Twitch API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.data) {
          for (const user of data.data) {
            const followerCount = await this.getFollowerCount(user.id);
            
            results.push({
              user_id: user.id,
              login: user.login,
              display_name: user.display_name,
              profile_image_url: user.profile_image_url || null,
              view_count: parseInt(user.view_count || 0),
              follower_count: followerCount,
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching batch Twitch users:', error);
      throw error;
    }
  }

  /**
   * ライブ配信情報を取得
   * @param {string} userId - TwitchユーザーID
   * @returns {Promise<Object|null>} ライブ配信情報
   */
  async getLiveStream(userId) {
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/streams?user_id=${userId}`;
      const response = await fetch(url, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return null; // 配信中ではない
      }

      const stream = data.data[0];
      
      return {
        stream_id: stream.id,
        user_id: stream.user_id,
        user_login: stream.user_login,
        user_name: stream.user_name,
        title: stream.title,
        viewer_count: stream.viewer_count,
        started_at: stream.started_at,
        thumbnail_url: stream.thumbnail_url,
        stream_url: `https://www.twitch.tv/${stream.user_login}`,
      };
    } catch (error) {
      console.error('Error fetching Twitch live stream:', error);
      throw error;
    }
  }

  /**
   * チャンネル情報を取得
   * @param {string} broadcasterId - TwitchユーザーID
   * @returns {Promise<Object>} チャンネル情報
   */
  async getChannelInfo(broadcasterId) {
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/channels?broadcaster_id=${broadcasterId}`;
      const response = await fetch(url, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('Channel not found');
      }

      const channel = data.data[0];
      
      return {
        broadcaster_id: channel.broadcaster_id,
        broadcaster_login: channel.broadcaster_login,
        broadcaster_name: channel.broadcaster_name,
        game_name: channel.game_name || null,
        title: channel.title || null,
        delay: channel.delay || 0,
      };
    } catch (error) {
      console.error('Error fetching Twitch channel info:', error);
      throw error;
    }
  }
}
