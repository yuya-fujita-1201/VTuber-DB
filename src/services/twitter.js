/**
 * Twitter/X API v2統合サービス
 */

export class TwitterService {
  constructor(bearerToken) {
    this.bearerToken = bearerToken;
    this.baseUrl = 'https://api.twitter.com/2';
  }

  /**
   * ユーザー情報を取得（ユーザー名から）
   * @param {string} username - Twitterユーザー名（@なし）
   * @returns {Promise<Object>} ユーザー情報
   */
  async getUserByUsername(username) {
    try {
      const url = `${this.baseUrl}/users/by/username/${username}?user.fields=id,name,username,description,public_metrics,profile_image_url,created_at`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data) {
        throw new Error('User not found');
      }

      const user = data.data;
      
      return {
        user_id: user.id,
        username: user.username,
        display_name: user.name,
        description: user.description || null,
        follower_count: user.public_metrics?.followers_count || 0,
        following_count: user.public_metrics?.following_count || 0,
        tweet_count: user.public_metrics?.tweet_count || 0,
        profile_image_url: user.profile_image_url || null,
        created_at: user.created_at,
      };
    } catch (error) {
      console.error('Error fetching Twitter user:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報を取得（ユーザーIDから）
   * @param {string} userId - TwitterユーザーID
   * @returns {Promise<Object>} ユーザー情報
   */
  async getUserById(userId) {
    try {
      const url = `${this.baseUrl}/users/${userId}?user.fields=id,name,username,description,public_metrics,profile_image_url,created_at`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data) {
        throw new Error('User not found');
      }

      const user = data.data;
      
      return {
        user_id: user.id,
        username: user.username,
        display_name: user.name,
        description: user.description || null,
        follower_count: user.public_metrics?.followers_count || 0,
        following_count: user.public_metrics?.following_count || 0,
        tweet_count: user.public_metrics?.tweet_count || 0,
        profile_image_url: user.profile_image_url || null,
        created_at: user.created_at,
      };
    } catch (error) {
      console.error('Error fetching Twitter user:', error);
      throw error;
    }
  }

  /**
   * 複数のユーザー情報を一括取得
   * @param {Array<string>} usernames - ユーザー名の配列
   * @returns {Promise<Array>} ユーザー情報の配列
   */
  async getBatchUsersByUsername(usernames) {
    try {
      const results = [];
      // Twitter APIは最大100件まで一度に取得可能
      const chunkSize = 100;
      
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const chunk = usernames.slice(i, i + chunkSize);
        const usernamesParam = chunk.join(',');
        
        const url = `${this.baseUrl}/users/by?usernames=${usernamesParam}&user.fields=id,name,username,public_metrics,profile_image_url`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Twitter API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.data) {
          for (const user of data.data) {
            results.push({
              user_id: user.id,
              username: user.username,
              display_name: user.name,
              follower_count: user.public_metrics?.followers_count || 0,
              following_count: user.public_metrics?.following_count || 0,
              tweet_count: user.public_metrics?.tweet_count || 0,
              profile_image_url: user.profile_image_url || null,
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching batch Twitter users:', error);
      throw error;
    }
  }

  /**
   * ユーザーの最新ツイートを取得
   * @param {string} userId - TwitterユーザーID
   * @param {number} maxResults - 最大結果数
   * @returns {Promise<Array>} ツイート一覧
   */
  async getUserTweets(userId, maxResults = 10) {
    try {
      const url = `${this.baseUrl}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data) {
        return [];
      }

      return data.data.map(tweet => ({
        tweet_id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        retweet_count: tweet.public_metrics?.retweet_count || 0,
        like_count: tweet.public_metrics?.like_count || 0,
        reply_count: tweet.public_metrics?.reply_count || 0,
      }));
    } catch (error) {
      console.error('Error fetching user tweets:', error);
      throw error;
    }
  }

  /**
   * ユーザー検索
   * @param {string} query - 検索クエリ
   * @returns {Promise<Array>} ユーザー一覧
   */
  async searchUsers(query) {
    try {
      // Note: User search endpoint requires Academic Research access
      // This is a placeholder implementation
      console.warn('Twitter user search requires Academic Research access');
      return [];
    } catch (error) {
      console.error('Error searching Twitter users:', error);
      throw error;
    }
  }
}
