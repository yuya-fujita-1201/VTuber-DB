# データ拡充タスク 分業計画

**作成日**: 2026-01-03  
**目的**: データ拡充ロードマップのタスクを、Manus AIとKamui-4Dで分業して実装

---

## 📋 タスク分業方針

### Manus AIが担当

- **既存コードの改修**: YouTubeService、既存スクリプトの修正
- **DB操作**: マイグレーション、データ投入
- **統合とテスト**: 全体の整合性確認

### Kamui-4Dが担当

- **新規機能の実装**: 独立性が高く、既存コードへの依存が少ない
- **管理画面の拡張**: 新規ページやコンポーネント
- **データ収集スクリプト**: 新規スクリプトの作成

---

## 🎯 Phase 2: 重複排除と新規発見の改善

### タスク2-1: YouTube検索の改善 ✅ **Manus担当**

**理由**: 既存の`YouTubeService`を修正する必要があるため

**実装内容**:
1. `YouTubeService.searchChannels()`に`order`パラメータを追加
2. `mass-collect-vtubers.js`で`order='date'`を使用
3. 新規キーワードを追加（「VTuber デビュー」「新人VTuber」）

**推定工数**: 2時間

---

### タスク2-2: 重複排除の強化 ✅ **Manus担当**

**理由**: 既存の`mass-collect-vtubers.js`を修正する必要があるため

**実装内容**:
1. 新規チャンネルが0件のキーワードをスキップ
2. スキップされたキーワードをログに記録

**推定工数**: 1時間

---

## 🎯 Phase 3: 全プロダクション・全メンバーのデータ収集

### タスク3-1: プロダクション別メンバーリストの作成 🔄 **Kamui-4D担当**

**理由**: データ収集作業で、既存コードへの依存が少ないため

**実装内容**:
1. ホロライブ全メンバーのチャンネルリストを作成
2. にじさんじ全メンバーのチャンネルリストを作成
3. 他プロダクションのチャンネルリストを作成
4. `data/vtuber_agencies_full.json`に保存

**データソース**:
- ホロライブ公式サイト: https://hololive.hololivepro.com/talents
- にじさんじ公式サイト: https://www.nijisanji.jp/talents
- VTuber Wiki: https://virtualyoutuber.fandom.com/

**期待される成果物**:
```json
{
  "agencies": [
    {
      "name": "ホロライブ",
      "name_en": "hololive",
      "divisions": [
        {
          "name": "ホロライブJP",
          "name_en": "hololive-jp",
          "channels": [
            {
              "name": "ときのそら",
              "channel_id": "UCp6993wxpyDPHUpavwDFqgg",
              "channel_url": "https://www.youtube.com/@TokinoSora"
            },
            ...
          ]
        },
        {
          "name": "ホロライブEN",
          "name_en": "hololive-en",
          "channels": [...]
        },
        {
          "name": "ホロライブID",
          "name_en": "hololive-id",
          "channels": [...]
        },
        {
          "name": "ホロスターズ",
          "name_en": "holostars",
          "channels": [...]
        }
      ]
    },
    {
      "name": "にじさんじ",
      "name_en": "nijisanji",
      "divisions": [
        {
          "name": "にじさんじJP",
          "name_en": "nijisanji-jp",
          "channels": [...]
        },
        {
          "name": "にじさんじEN",
          "name_en": "nijisanji-en",
          "channels": [...]
        },
        {
          "name": "にじさんじID",
          "name_en": "nijisanji-id",
          "channels": [...]
        },
        {
          "name": "にじさんじKR",
          "name_en": "nijisanji-kr",
          "channels": [...]
        }
      ]
    },
    {
      "name": "ぶいすぽっ!",
      "name_en": "vspo",
      "channels": [...]
    },
    ...
  ]
}
```

**受け入れ条件**:
- ホロライブ全メンバー（約110人）のチャンネルIDを取得
- にじさんじ全メンバー（約150人）のチャンネルIDを取得
- 他プロダクション（約100人）のチャンネルIDを取得
- JSONファイルとして保存

**推定工数**: 4時間

---

### タスク3-2: プロダクション別バッチ収集 ✅ **Manus担当**

**理由**: 既存の`batch-collect-vtubers.js`を拡張する必要があるため

**実装内容**:
1. `data/vtuber_agencies_full.json`を読み込む機能を追加
2. プロダクション別・部門別に収集する機能を追加
3. 管理画面に「プロダクション別収集」セクションを追加

**推定工数**: 2時間

---

## 🎯 Phase 4: 空テーブルの充填

### タスク4-1: 動画データの収集 ✅ **Manus担当**

**理由**: 既存ジョブ`fetch_recent_contents`を使用するため

**実装内容**:
1. 管理画面に「動画データ収集」ボタンを追加
2. `POST /api/admin/batch-fetch-contents`エンドポイントを追加
3. 全VTuberに対して`fetch_recent_contents`ジョブをenqueue

**推定工数**: 1時間

---

### タスク4-2: AIタグ付けの実行 ✅ **Manus担当**

**理由**: 既存ジョブ`ai_tagging_vtuber`を使用するため

**実装内容**:
- 既に実装済み（`POST /api/admin/batch-tag`）
- 管理画面で実行可能

**推定工数**: 0時間（実装済み）

---

### タスク4-3: タグ関連度の計算 ✅ **Manus担当**

**理由**: 既存ジョブ`build_tag_relations`を使用するため

**実装内容**:
1. 管理画面に「タグ関連度計算」ボタンを追加
2. `POST /api/admin/build-tag-relations`エンドポイントを追加
3. `build_tag_relations`ジョブをenqueue

**推定工数**: 1時間

---

## 🎯 Phase 5: 定期自動実行の実装

### タスク5-1: Cron Triggerの設定 ✅ **Manus担当**

**理由**: `wrangler.toml`の設定とCron処理の実装が必要

**実装内容**:
1. `wrangler.toml`にCron Triggerを追加
2. Cron処理を実装（`src/cron/index.js`）

**推定工数**: 1時間

---

### タスク5-2: 自動実行ジョブの作成 🔄 **Kamui-4D担当**

**理由**: 新規スクリプトの作成で、既存コードへの依存が少ないため

**実装内容**:
1. `src/cron/weekly-collect.js`: 毎週日曜日に新規VTuberを100件収集
2. `src/cron/daily-update.js`: 毎日既存VTuberのデータを更新
3. `src/cron/daily-maintenance.js`: 毎日空テーブルを埋める

**期待される成果物**:
```javascript
// src/cron/weekly-collect.js
export async function weeklyCollect(env) {
  console.log('[Cron] Weekly collect started');
  
  // 新規VTuberを100件収集（date順）
  const result = await massCollectVTubers(env, {
    targetCount: 100,
    order: 'date',  // 新しい順
    skipExisting: true,
  });
  
  console.log(`[Cron] Weekly collect completed: ${result.collected} collected`);
  return result;
}

// src/cron/daily-update.js
export async function dailyUpdate(env) {
  console.log('[Cron] Daily update started');
  
  const db = env.DB;
  
  // Tier 1（人気VTuber）のチャンネル情報を更新
  const { results: tier1 } = await db
    .prepare('SELECT id, channel_id FROM vtubers WHERE sync_tier = 1 LIMIT 100')
    .all();
  
  for (const vtuber of tier1) {
    await db
      .prepare(`
        INSERT INTO jobs (job_type, payload, priority)
        VALUES (?, ?, ?)
      `)
      .bind(
        'initial_sync_channel',
        JSON.stringify({ vtuber_id: vtuber.id, channel_id: vtuber.channel_id }),
        5
      )
      .run();
  }
  
  console.log(`[Cron] Daily update completed: ${tier1.length} jobs enqueued`);
  return { updated: tier1.length };
}

// src/cron/daily-maintenance.js
export async function dailyMaintenance(env) {
  console.log('[Cron] Daily maintenance started');
  
  const db = env.DB;
  let totalJobs = 0;
  
  // 1. youtube_contentsが空のVTuberに対してfetch_recent_contentsジョブをenqueue
  const { results: withoutContents } = await db
    .prepare(`
      SELECT v.id, yc.channel_id
      FROM vtubers v
      JOIN youtube_channels yc ON v.id = yc.vtuber_id
      LEFT JOIN youtube_contents yco ON v.id = yco.vtuber_id
      WHERE yco.vtuber_id IS NULL
      LIMIT 50
    `)
    .all();
  
  for (const vtuber of withoutContents) {
    await db
      .prepare(`
        INSERT INTO jobs (job_type, payload, priority)
        VALUES (?, ?, ?)
      `)
      .bind(
        'fetch_recent_contents',
        JSON.stringify({ vtuber_id: vtuber.id, channel_id: vtuber.channel_id }),
        6
      )
      .run();
    totalJobs++;
  }
  
  // 2. vtuber_tagsが空のVTuberに対してai_tagging_vtuberジョブをenqueue
  const { results: withoutTags } = await db
    .prepare(`
      SELECT v.id
      FROM vtubers v
      LEFT JOIN vtuber_tags vt ON v.id = vt.vtuber_id
      WHERE vt.vtuber_id IS NULL
      LIMIT 10
    `)
    .all();
  
  for (const vtuber of withoutTags) {
    await db
      .prepare(`
        INSERT INTO jobs (job_type, payload, priority)
        VALUES (?, ?, ?)
      `)
      .bind(
        'ai_tagging_vtuber',
        JSON.stringify({ vtuber_id: vtuber.id }),
        7
      )
      .run();
    totalJobs++;
  }
  
  console.log(`[Cron] Daily maintenance completed: ${totalJobs} jobs enqueued`);
  return { jobs_enqueued: totalJobs };
}
```

**受け入れ条件**:
- 3つのCronジョブが正しく動作する
- エラーハンドリングが適切
- ログ出力が適切

**推定工数**: 3時間

---

## 🎯 Phase 6: データメンテナンスの自動化

### タスク6-1: メンテナンスジョブの作成 ✅ **Manus担当**

**理由**: Phase 5-2で既に実装されるため

**実装内容**:
- Phase 5-2の`daily-maintenance.js`で実装済み

**推定工数**: 0時間（Phase 5-2に含まれる）

---

## 📊 タスク一覧と担当

| Phase | タスク | 担当 | 優先度 | 推定工数 | 状態 |
|---|---|---|---|---|---|
| Phase 2 | YouTube検索の改善 | Manus | 🔴 高 | 2時間 | 🔜 次 |
| Phase 2 | 重複排除の強化 | Manus | 🟡 中 | 1時間 | 🔜 次 |
| Phase 3 | プロダクション別メンバーリスト作成 | Kamui-4D | 🔴 高 | 4時間 | ⏳ 待機 |
| Phase 3 | プロダクション別バッチ収集 | Manus | 🔴 高 | 2時間 | ⏳ 待機 |
| Phase 4 | 動画データの収集 | Manus | 🟡 中 | 1時間 | ⏳ 待機 |
| Phase 4 | AIタグ付けの実行 | Manus | 🟡 中 | 0時間 | ✅ 完了 |
| Phase 4 | タグ関連度の計算 | Manus | 🟢 低 | 1時間 | ⏳ 待機 |
| Phase 5 | Cron Triggerの設定 | Manus | 🟡 中 | 1時間 | ⏳ 待機 |
| Phase 5 | 自動実行ジョブの作成 | Kamui-4D | 🟡 中 | 3時間 | ⏳ 待機 |
| Phase 6 | メンテナンスジョブの作成 | Manus | 🟢 低 | 0時間 | ⏳ 待機 |

**Manus合計**: 8時間  
**Kamui-4D合計**: 7時間  
**総合計**: 15時間

---

## 🚀 実装順序

### ステップ1: Manus（Phase 2）

1. YouTube検索の改善（2時間）
2. 重複排除の強化（1時間）

**完了後**: 大規模収集機能で新規VTuberが取れるようになる

---

### ステップ2: Kamui-4D（Phase 3-1）

1. プロダクション別メンバーリストの作成（4時間）

**完了後**: `data/vtuber_agencies_full.json`が作成される

---

### ステップ3: Manus（Phase 3-2）

1. プロダクション別バッチ収集（2時間）

**完了後**: 管理画面でプロダクション別に収集できるようになる

---

### ステップ4: Manus（Phase 4）

1. 動画データの収集（1時間）
2. タグ関連度の計算（1時間）

**完了後**: 空テーブルが埋まる

---

### ステップ5: Kamui-4D（Phase 5-2）

1. 自動実行ジョブの作成（3時間）

**完了後**: Cronジョブが作成される

---

### ステップ6: Manus（Phase 5-1）

1. Cron Triggerの設定（1時間）

**完了後**: 定期自動実行が動作する

---

## 📝 Kamui-4D用の指示書

### タスクE: プロダクション別メンバーリストの作成

**プロジェクト概要**:
VTuber-DBは「探索型VTuber発見エンジン」で、現在約50件のVTuberデータがあります。これを2000件以上に拡張するため、全プロダクション・全メンバーのチャンネルリストを作成します。

**目標**:
ホロライブ、にじさんじ、他プロダクションの全メンバーのチャンネルIDを取得し、JSONファイルとして保存する。

**データソース**:
1. ホロライブ公式サイト: https://hololive.hololivepro.com/talents
2. にじさんじ公式サイト: https://www.nijisanji.jp/talents
3. VTuber Wiki: https://virtualyoutuber.fandom.com/
4. 各プロダクションの公式サイト

**実装するファイル**:
- `data/vtuber_agencies_full.json`

**JSONフォーマット**:
```json
{
  "agencies": [
    {
      "name": "ホロライブ",
      "name_en": "hololive",
      "divisions": [
        {
          "name": "ホロライブJP",
          "name_en": "hololive-jp",
          "channels": [
            {
              "name": "ときのそら",
              "channel_id": "UCp6993wxpyDPHUpavwDFqgg",
              "channel_url": "https://www.youtube.com/@TokinoSora"
            }
          ]
        }
      ]
    }
  ]
}
```

**受け入れ条件**:
- ホロライブ全メンバー（約110人）
- にじさんじ全メンバー（約150人）
- 他プロダクション（約100人）
- 合計約360人のチャンネルIDを取得

**推定工数**: 4時間

---

### タスクF: 自動実行ジョブの作成

**プロジェクト概要**:
VTuber-DBのデータを定期的に自動更新するため、Cronジョブを作成します。

**目標**:
毎週日曜日に新規VTuberを100件収集、毎日既存VTuberのデータを更新、毎日空テーブルを埋める。

**実装するファイル**:
1. `src/cron/weekly-collect.js`
2. `src/cron/daily-update.js`
3. `src/cron/daily-maintenance.js`

**技術スタック**:
- Cloudflare Workers（Cron Triggers）
- Cloudflare D1（SQLite）
- Hono（Web Framework）

**受け入れ条件**:
- 3つのCronジョブが正しく動作する
- エラーハンドリングが適切
- ログ出力が適切

**推定工数**: 3時間

---

## 🎯 次のアクション

1. **Manus**: Phase 2（YouTube検索の改善）を実装
2. **Kamui-4D**: タスクE（プロダクション別メンバーリスト作成）を実装

---

**作成日**: 2026-01-03  
**作成者**: Manus AI
