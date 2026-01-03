import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { YouTubeService } from '../services/youtube.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * channel_ids指定でVTuberを収集するスクリプト
 * 
 * agency_channel_ids.jsonから全VTuberのchannel_idを読み込み、
 * YouTube APIで情報を取得してDBに保存する
 */

// 環境変数チェック
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const CLOUDFLARE_D1_TOKEN = process.env.CLOUDFLARE_D1_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;

if (!YOUTUBE_API_KEY) {
  console.error('[Collect] エラー: YOUTUBE_API_KEYが設定されていません');
  process.exit(1);
}

// バッチサイズ
const BATCH_SIZE = 50; // YouTube API: 最大50件/リクエスト
const DELAY_MS = 1000; // レート制限対策: 1秒待機

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getExistingChannelIds(db) {
  try {
    const { results } = await db
      .prepare('SELECT channel_id FROM youtube_channels')
      .all();
    return new Set(results.map((r) => r.channel_id));
  } catch (error) {
    console.warn('[Collect] youtube_channelsテーブルが見つかりません。すべて新規として処理します。');
    return new Set();
  }
}

async function insertVTuber(db, channelInfo, metadata) {
  try {
    // vtubers テーブルに挿入
    const vtuberResult = await db
      .prepare(`
        INSERT INTO vtubers (
          name,
          name_en,
          agency_id,
          debut_date,
          graduation_date,
          description,
          sync_tier,
          stale_level,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        channelInfo.channel_name,
        metadata?.name || channelInfo.channel_name,
        null, // agency_id は後で設定
        null, // debut_date
        null, // graduation_date
        channelInfo.description || '',
        1, // sync_tier: S (デフォルト)
        0  // stale_level: 0 (最新)
      )
      .run();

    const vtuberId = vtuberResult.meta.last_row_id;

    // youtube_channels テーブルに挿入
    await db
      .prepare(`
        INSERT INTO youtube_channels (
          vtuber_id,
          channel_id,
          channel_name,
          custom_url,
          subscriber_count,
          view_count,
          video_count,
          thumbnail_url,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        vtuberId,
        channelInfo.channel_id,
        channelInfo.channel_name,
        channelInfo.custom_url || '',
        channelInfo.subscriber_count || 0,
        channelInfo.view_count || 0,
        channelInfo.video_count || 0,
        channelInfo.thumbnail_url || ''
      )
      .run();

    return { success: true, vtuber_id: vtuberId };
  } catch (error) {
    console.error(`[Collect] エラー: ${channelInfo.channel_id} の挿入に失敗`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('[Collect] channel_ids指定でVTuber収集を開始します');

  // agency_channel_ids.jsonを読み込む
  const channelIdsPath = path.join(__dirname, '../../data/agency_channel_ids.json');
  
  if (!fs.existsSync(channelIdsPath)) {
    console.error('[Collect] エラー: agency_channel_ids.jsonが見つかりません');
    console.error('[Collect] 先にbatch-collect-agencies.jsを実行してください');
    process.exit(1);
  }

  const { channel_ids, channel_map } = JSON.parse(fs.readFileSync(channelIdsPath, 'utf-8'));
  console.log(`[Collect] 総VTuber数: ${channel_ids.length}人`);

  // YouTube APIサービスを初期化
  const youtubeService = new YouTubeService(YOUTUBE_API_KEY);

  // Cloudflare D1に接続
  let db;
  if (CLOUDFLARE_D1_TOKEN && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_DATABASE_ID) {
    console.log('[Collect] Cloudflare D1に接続します');
    // Cloudflare D1 REST APIを使用
    const D1Client = (await import('../db/d1-client.js')).default;
    db = new D1Client({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      databaseId: CLOUDFLARE_DATABASE_ID,
      token: CLOUDFLARE_D1_TOKEN,
    });
  } else if (DATABASE_URL) {
    console.log('[Collect] ローカルDBに接続します');
    // ローカルSQLiteを使用
    const Database = (await import('better-sqlite3')).default;
    const dbPath = DATABASE_URL.replace('file:', '');
    const sqlite = new Database(dbPath);
    
    // better-sqlite3をD1互換のインターフェースでラップ
    db = {
      prepare: (sql) => {
        const stmt = sqlite.prepare(sql);
        return {
          bind: (...params) => ({
            run: () => {
              const info = stmt.run(...params);
              return { meta: { last_row_id: info.lastInsertRowid } };
            },
            all: () => {
              const results = stmt.all(...params);
              return { results };
            },
          }),
          run: () => {
            const info = stmt.run();
            return { meta: { last_row_id: info.lastInsertRowid } };
          },
          all: () => {
            const results = stmt.all();
            return { results };
          },
        };
      },
    };
  } else {
    console.error('[Collect] エラー: データベース接続情報が設定されていません');
    console.error('[Collect] CLOUDFLARE_D1_TOKEN または DATABASE_URL を設定してください');
    process.exit(1);
  }

  // 既存のchannel_idを取得
  console.log('[Collect] 既存のchannel_idを確認します');
  const existingChannelIds = await getExistingChannelIds(db);
  console.log(`[Collect] 既存VTuber数: ${existingChannelIds.size}人`);

  // 新規channel_idをフィルタリング
  const newChannelIds = channel_ids.filter((id) => !existingChannelIds.has(id));
  console.log(`[Collect] 新規VTuber数: ${newChannelIds.length}人`);

  if (newChannelIds.length === 0) {
    console.log('[Collect] 新規VTuberがありません。処理を終了します。');
    return;
  }

  // バッチ処理
  let collected = 0;
  let errors = 0;

  for (let i = 0; i < newChannelIds.length; i += BATCH_SIZE) {
    const batch = newChannelIds.slice(i, i + BATCH_SIZE);
    console.log(`\n[Collect] バッチ ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newChannelIds.length / BATCH_SIZE)}: ${batch.length}件`);

    try {
      // YouTube APIでチャンネル情報を取得
      const channelInfos = await youtubeService.getBatchChannelInfo(batch);
      console.log(`[Collect] YouTube APIから${channelInfos.length}件取得しました`);

      // DBに挿入
      for (const channelInfo of channelInfos) {
        const metadata = channel_map[channelInfo.channel_id];
        const result = await insertVTuber(db, channelInfo, metadata);
        
        if (result.success) {
          collected++;
          console.log(`[Collect] ✓ ${channelInfo.channel_name} (${channelInfo.channel_id})`);
        } else {
          errors++;
        }
      }

      // レート制限対策: 1秒待機
      if (i + BATCH_SIZE < newChannelIds.length) {
        console.log(`[Collect] レート制限対策: ${DELAY_MS}ms待機...`);
        await sleep(DELAY_MS);
      }
    } catch (error) {
      console.error(`[Collect] バッチ処理エラー:`, error.message);
      errors += batch.length;
    }
  }

  console.log('\n[Collect] 完了');
  console.log(`  - 収集成功: ${collected}人`);
  console.log(`  - エラー: ${errors}件`);
  console.log('\n[Collect] 次のステップ:');
  console.log('  - src/scripts/fill-empty-tables.jsを実行して空テーブルを充填');
}

main().catch((error) => {
  console.error('[Collect] エラー:', error);
  process.exit(1);
});
