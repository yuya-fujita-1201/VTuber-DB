/**
 * AIタグづけサービス
 * OpenAI APIを使用してVTuberの属性タグを自動生成
 */

export class AITaggerService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  /**
   * VTuberの情報からタグを生成
   * @param {Object} vtuber - VTuber情報
   * @param {Array} availableTags - 利用可能なタグ一覧
   * @returns {Promise<Array>} 推奨タグとconfidenceスコアの配列
   */
  async generateTags(vtuber, availableTags) {
    try {
      // タグをカテゴリ別に整理
      const tagsByCategory = availableTags.reduce((acc, tag) => {
        if (!acc[tag.category]) {
          acc[tag.category] = [];
        }
        acc[tag.category].push(tag.name);
        return acc;
      }, {});

      // プロンプト作成
      const prompt = this.createTaggingPrompt(vtuber, tagsByCategory);

      // OpenAI APIを呼び出し
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'あなたはVTuberの属性を分析し、適切なタグを付与する専門家です。提供された情報から、最も適切なタグを選択し、JSON形式で返してください。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const result = JSON.parse(content);

      // タグIDとconfidenceスコアに変換
      const tagMap = new Map(availableTags.map(t => [t.name, t]));
      const tags = [];

      if (result.tags && Array.isArray(result.tags)) {
        for (const tagInfo of result.tags) {
          const tag = tagMap.get(tagInfo.name);
          if (tag) {
            tags.push({
              tag_id: tag.id,
              tag_name: tag.name,
              category: tag.category,
              confidence: tagInfo.confidence || 0.8,
              reason: tagInfo.reason || '',
            });
          }
        }
      }

      return tags;
    } catch (error) {
      console.error('Error generating tags:', error);
      throw error;
    }
  }

  /**
   * タグづけ用のプロンプトを作成
   * @param {Object} vtuber - VTuber情報
   * @param {Object} tagsByCategory - カテゴリ別タグ
   * @returns {string} プロンプト
   */
  createTaggingPrompt(vtuber, tagsByCategory) {
    return `
以下のVTuberの情報を分析し、適切なタグを選択してください。

# VTuber情報
名前: ${vtuber.name}
${vtuber.name_en ? `英語名: ${vtuber.name_en}` : ''}
${vtuber.description ? `説明: ${vtuber.description}` : ''}
${vtuber.agency ? `所属: ${vtuber.agency}` : ''}
${vtuber.youtube_subscribers ? `YouTube登録者数: ${vtuber.youtube_subscribers.toLocaleString()}人` : ''}
${vtuber.twitter_followers ? `Twitterフォロワー数: ${vtuber.twitter_followers.toLocaleString()}人` : ''}

# 利用可能なタグ

## 外見属性 (appearance)
${tagsByCategory.appearance ? tagsByCategory.appearance.join(', ') : 'なし'}

## 配信傾向 (content)
${tagsByCategory.content ? tagsByCategory.content.join(', ') : 'なし'}

## 特技・特徴 (skill)
${tagsByCategory.skill ? tagsByCategory.skill.join(', ') : 'なし'}

## 性格・雰囲気 (personality)
${tagsByCategory.personality ? tagsByCategory.personality.join(', ') : 'なし'}

## その他
${tagsByCategory.affiliation ? tagsByCategory.affiliation.join(', ') : ''}
${tagsByCategory.status ? tagsByCategory.status.join(', ') : ''}
${tagsByCategory.special ? tagsByCategory.special.join(', ') : ''}
${tagsByCategory.technical ? tagsByCategory.technical.join(', ') : ''}

# 指示
1. 提供された情報から、このVTuberに最も適切なタグを5〜15個選択してください
2. 各タグには0.0〜1.0のconfidenceスコアを付与してください（確信度が高いほど1.0に近い）
3. なぜそのタグを選択したのか、簡単な理由も記載してください
4. 情報が不足している場合は、推測せず確実に判断できるタグのみを選択してください

# 出力形式
以下のJSON形式で出力してください：
{
  "tags": [
    {
      "name": "タグ名",
      "confidence": 0.9,
      "reason": "選択理由"
    }
  ]
}
`;
  }

  /**
   * 複数のVTuberに対してバッチでタグを生成
   * @param {Array} vtubers - VTuber情報の配列
   * @param {Array} availableTags - 利用可能なタグ一覧
   * @returns {Promise<Array>} VTuber IDごとのタグ配列
   */
  async batchGenerateTags(vtubers, availableTags) {
    const results = [];

    for (const vtuber of vtubers) {
      try {
        const tags = await this.generateTags(vtuber, availableTags);
        results.push({
          vtuber_id: vtuber.id,
          tags: tags,
        });

        // レート制限対策（少し待機）
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error tagging vtuber ${vtuber.id}:`, error);
        results.push({
          vtuber_id: vtuber.id,
          tags: [],
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * 既存のタグを再評価
   * @param {Object} vtuber - VTuber情報
   * @param {Array} currentTags - 現在のタグ
   * @param {Array} availableTags - 利用可能なタグ一覧
   * @returns {Promise<Object>} 追加・削除すべきタグの提案
   */
  async reevaluateTags(vtuber, currentTags, availableTags) {
    try {
      const currentTagNames = currentTags.map(t => t.name);
      
      const prompt = `
以下のVTuberには現在以下のタグが付与されています：
${currentTagNames.join(', ')}

VTuber情報:
名前: ${vtuber.name}
${vtuber.description ? `説明: ${vtuber.description}` : ''}

このタグ付けを評価し、以下を提案してください：
1. 追加すべきタグ（現在付与されていないが適切なタグ）
2. 削除すべきタグ（不適切または不正確なタグ）
3. 各提案の理由

利用可能なタグ: ${availableTags.map(t => t.name).join(', ')}

JSON形式で出力してください：
{
  "add": [{"name": "タグ名", "confidence": 0.8, "reason": "理由"}],
  "remove": [{"name": "タグ名", "reason": "理由"}],
  "keep": ["タグ名"]
}
`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'あなたはVTuberのタグ付けを評価し、改善提案を行う専門家です。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const result = JSON.parse(content);

      // タグIDに変換
      const tagMap = new Map(availableTags.map(t => [t.name, t]));
      
      const addTags = (result.add || []).map(t => ({
        tag_id: tagMap.get(t.name)?.id,
        tag_name: t.name,
        confidence: t.confidence,
        reason: t.reason,
      })).filter(t => t.tag_id);

      const removeTags = (result.remove || []).map(t => ({
        tag_id: tagMap.get(t.name)?.id,
        tag_name: t.name,
        reason: t.reason,
      })).filter(t => t.tag_id);

      return {
        add: addTags,
        remove: removeTags,
        keep: result.keep || [],
      };
    } catch (error) {
      console.error('Error reevaluating tags:', error);
      throw error;
    }
  }
}
