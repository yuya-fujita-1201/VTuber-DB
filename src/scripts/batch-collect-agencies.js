import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * プロダクション別バッチ収集スクリプト
 * 
 * vtuber_agencies_full.jsonから全VTuberのchannel_idを読み込み、
 * 既存のmass-collect-vtubers.jsを使って収集する
 */

async function main() {
  console.log('[Batch Collect] プロダクション別バッチ収集を開始します');

  // vtuber_agencies_full.jsonを読み込む
  const agenciesPath = path.join(__dirname, '../../data/vtuber_agencies_full.json');
  
  if (!fs.existsSync(agenciesPath)) {
    console.error('[Batch Collect] エラー: vtuber_agencies_full.jsonが見つかりません');
    console.error(`[Batch Collect] パス: ${agenciesPath}`);
    process.exit(1);
  }

  const agenciesData = JSON.parse(fs.readFileSync(agenciesPath, 'utf-8'));
  console.log(`[Batch Collect] vtuber_agencies_full.jsonを読み込みました`);
  console.log(`[Batch Collect] agencies数: ${agenciesData.agencies ? agenciesData.agencies.length : 'undefined'}`);

  // すべてのchannel_idを抽出
  const channelIds = [];
  const channelMap = new Map(); // channel_id -> { name, agency, division }

  for (const agency of agenciesData.agencies) {
    console.log(`[Batch Collect] 処理中: ${agency.name}, divisions: ${agency.divisions ? agency.divisions.length : 'undefined'}`);
    
    // divisionsがない場合は、channelsを直接処理
    if (!agency.divisions && agency.channels) {
      for (const channel of agency.channels) {
        channelIds.push(channel.channel_id);
        channelMap.set(channel.channel_id, {
          name: channel.name,
          agency: agency.name,
          agency_en: agency.name_en,
          division: null,
          division_en: null,
        });
      }
      continue;
    }
    
    for (const division of agency.divisions || []) {
      for (const channel of division.channels) {
        channelIds.push(channel.channel_id);
        channelMap.set(channel.channel_id, {
          name: channel.name,
          agency: agency.name,
          agency_en: agency.name_en,
          division: division.name,
          division_en: division.name_en,
        });
      }
    }
  }

  console.log(`[Batch Collect] 総VTuber数: ${channelIds.length}人`);

  // channel_idsをファイルに保存
  const channelIdsPath = path.join(__dirname, '../../data/agency_channel_ids.json');
  fs.writeFileSync(
    channelIdsPath,
    JSON.stringify({ channel_ids: channelIds, channel_map: Object.fromEntries(channelMap) }, null, 2)
  );
  console.log(`[Batch Collect] channel_idsを保存しました: ${channelIdsPath}`);

  // 統計情報を表示
  const agencyStats = {};
  for (const [channelId, info] of channelMap.entries()) {
    if (!agencyStats[info.agency]) {
      agencyStats[info.agency] = 0;
    }
    agencyStats[info.agency]++;
  }

  console.log('\n[Batch Collect] 事務所別統計:');
  for (const [agency, count] of Object.entries(agencyStats)) {
    console.log(`  - ${agency}: ${count}人`);
  }

  console.log('\n[Batch Collect] 次のステップ:');
  console.log('  1. src/scripts/collect-by-channel-ids.jsを実行してVTuberデータを収集');
  console.log('  2. src/scripts/fill-empty-tables.jsを実行して空テーブルを充填');
  console.log('\n[Batch Collect] 完了');
}

main().catch((error) => {
  console.error('[Batch Collect] エラー:', error);
  process.exit(1);
});
