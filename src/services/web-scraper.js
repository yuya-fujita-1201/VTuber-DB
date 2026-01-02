/**
 * Webスクレイピングサービス
 * VTuberの公式サイトやWikiから情報を収集
 */

export class WebScraperService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (compatible; VTuberDB/1.0; +https://vtuber-db.pages.dev)';
  }

  /**
   * HTMLからテキストコンテンツを抽出
   */
  extractTextContent(html) {
    // HTMLタグを削除
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * メタタグから情報を抽出
   */
  extractMetadata(html) {
    const metadata = {};

    // タイトル
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // メタディスクリプション
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // OGP情報
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    if (ogTitleMatch) {
      metadata.og_title = ogTitleMatch[1].trim();
    }

    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
    if (ogDescMatch) {
      metadata.og_description = ogDescMatch[1].trim();
    }

    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    if (ogImageMatch) {
      metadata.og_image = ogImageMatch[1].trim();
    }

    return metadata;
  }

  /**
   * 公式サイトから情報を取得
   */
  async scrapeOfficialSite(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        },
        signal: AbortSignal.timeout(10000), // 10秒タイムアウト
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const metadata = this.extractMetadata(html);
      const textContent = this.extractTextContent(html);

      return {
        success: true,
        url,
        metadata,
        textContent: textContent.substring(0, 5000), // 最初の5000文字
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return {
        success: false,
        url,
        error: error.message,
        scrapedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * VTuber Wikiから情報を取得
   */
  async scrapeVTuberWiki(vtuberName) {
    try {
      // VTuber Wiki（仮想URL、実際のWikiに合わせて調整）
      const searchUrl = `https://virtualyoutuber.fandom.com/wiki/${encodeURIComponent(vtuberName)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          success: false,
          url: searchUrl,
          error: `HTTP ${response.status}`,
        };
      }

      const html = await response.text();
      const metadata = this.extractMetadata(html);
      const textContent = this.extractTextContent(html);

      // Wikiから特定の情報を抽出（簡易版）
      const info = {
        name: vtuberName,
        description: metadata.description || '',
        content: textContent.substring(0, 3000),
      };

      return {
        success: true,
        url: searchUrl,
        source: 'wiki',
        info,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error scraping wiki for ${vtuberName}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Google検索でVTuber情報を検索
   */
  async searchVTuberInfo(vtuberName) {
    try {
      // Google検索（実際にはSearch APIを使用するのが望ましい）
      const searchQuery = `${vtuberName} VTuber プロフィール`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      // 注: Google検索の直接スクレイピングは利用規約違反の可能性があります
      // 実際の実装では、Google Custom Search APIなどの公式APIを使用してください
      
      return {
        success: false,
        message: 'Google Custom Search API integration required',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ニュース記事を検索
   */
  async searchNews(vtuberName, limit = 5) {
    try {
      // ニュース検索（実際にはNews APIなどを使用）
      // ここでは簡易的な実装
      
      return {
        success: false,
        message: 'News API integration required',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 複数のソースから情報を収集
   */
  async scrapeAllSources(vtuber) {
    const results = {
      vtuber_id: vtuber.id,
      vtuber_name: vtuber.name,
      sources: [],
    };

    // 公式サイト
    if (vtuber.official_website) {
      const officialData = await this.scrapeOfficialSite(vtuber.official_website);
      if (officialData.success) {
        results.sources.push({
          type: 'official_site',
          url: vtuber.official_website,
          data: officialData,
        });
      }
    }

    // Wiki
    const wikiData = await this.scrapeVTuberWiki(vtuber.name);
    if (wikiData.success) {
      results.sources.push({
        type: 'wiki',
        url: wikiData.url,
        data: wikiData,
      });
    }

    return results;
  }
}
