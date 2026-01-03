# VTuber-DB データ拡充ロードマップ

**作成日**: 2026-01-03  
**目標**: データを継続的に拡充・メンテナンスし、新規VTuberの自動発見と既存データの更新を実現

---

## 🎯 最終目標

1. **データ量**: 50件 → 2000件以上
2. **網羅性**: 全プロダクション・全メンバーをカバー
3. **鮮度**: 新規VTuberを自動発見（毎週/毎月）
4. **完全性**: 空テーブルを埋める（タグ、動画、関連度など）
5. **自動化**: 定期実行でメンテナンスフリー

---

## 📊 現状分析

### ✅ 実装済み

- 大規模収集機能（YouTube検索ベース）
- 重複排除（`channel_id`ベース）
- レート制限対策
- クォータ超過時の停止

### ⚠️ 課題

1. **重複排除の限界**
   - 現状: `channel_id`で重複チェック → ✅ 動作している
   - 問題: YouTube検索結果が古いチャンネルに偏る可能性
   - 結果: 新規VTuberが取得されにくい

2. **データの偏り**
   - ホロライブ・にじさんじのみ（約50件）
   - 全メンバーが入っていない
   - ホロライブEN、ホロスターズなどの細分化がない

3. **空テーブル**
   - `youtube_contents`: 動画データがほぼ空
   - `vtuber_tag_evidence`: タグ根拠がほぼ空
   - `tag_relations`: タグ関連度がほぼ空
   - `streams`: 配信データがほぼ空

4. **新規発見の弱さ**
   - YouTube検索は「人気順」がデフォルト
   - 新人VTuberは検索結果の下位に埋もれる
   - 1ヶ月後に実行しても新人が取れない可能性

---

## 📋 段階的タスク

### Phase 1: 現状分析と段階的タスクの策定 ✅

**完了**: このドキュメントの作成

---

### Phase 2: 重複排除と新規発見の改善

**目標**: 2回目以降の実行で新規VTuberを確実に取得

#### タスク2-1: YouTube検索の改善

**問題**: 検索結果が古いチャンネルに偏る

**解決策**:
1. **検索順序の変更**: `relevance`（関連度順）→ `date`（新しい順）
2. **検索期間の指定**: `publishedAfter`パラメータで最近1ヶ月のチャンネルを優先
3. **新規キーワードの追加**: 「VTuber デビュー」「新人VTuber」など

**実装**:
```javascript
// YouTubeService.searchChannels() に order パラメータを追加
searchChannels(query, maxResults = 50, order = 'relevance')

// 新規VTuber優先モード
searchChannels('VTuber デビュー', 50, 'date')
```

**期待される効果**:
- 新人VTuberが検索結果の上位に来る
- 1ヶ月後に実行すると、その間にデビューしたVTuberが取れる

---

#### タスク2-2: 重複排除の強化

**問題**: 既存チャンネルが多いと、新規チャンネルが見つかりにくい

**解決策**:
1. **検索結果のフィルタリング**: 既存チャンネルを除外してから検索
2. **検索キーワードの動的調整**: 既存チャンネルが多いキーワードはスキップ

**実装**:
```javascript
// 新規チャンネルが0件のキーワードは次回スキップ
const skippedKeywords = new Set();

if (newChannels.length === 0) {
  skippedKeywords.add(keyword);
  console.log(`[Mass Collect] Skipping keyword: ${keyword} (no new channels)`);
  continue;
}
```

**期待される効果**:
- 無駄な検索を減らし、APIクォータを節約
- 新規チャンネルが見つかりやすいキーワードに集中

---

### Phase 3: 全プロダクション・全メンバーのデータ収集

**目標**: ホロライブ・にじさんじの全メンバー + 他プロダクションを網羅

#### タスク3-1: プロダクション別メンバーリストの作成

**データソース**:
1. **公式サイト**: ホロライブ、にじさんじの公式サイトからスクレイピング
2. **VTuber Wiki**: https://virtualyoutuber.fandom.com/
3. **手動リスト**: `data/vtuber_agencies.json`を拡充

**実装**:
```json
{
  "agencies": [
    {
      "name": "ホロライブ",
      "name_en": "hololive",
      "divisions": [
        {
          "name": "ホロライブJP",
          "channels": [...]
        },
        {
          "name": "ホロライブEN",
          "channels": [...]
        },
        {
          "name": "ホロスターズ",
          "channels": [...]
        }
      ]
    }
  ]
}
```

**期待される効果**:
- ホロライブJP: 約80人
- ホロライブEN: 約20人
- ホロスターズ: 約10人
- にじさんじ: 約150人
- 他プロダクション: 約100人
- **合計**: 約360人

---

#### タスク3-2: プロダクション別バッチ収集

**実装**:
```javascript
// 管理画面に「プロダクション別収集」ボタンを追加
POST /api/admin/collect-by-agency
body: { agency: "hololive", division: "hololive-en" }
```

**期待される効果**:
- プロダクション別に確実に全メンバーを収集
- 手動で確認しながら段階的に追加

---

### Phase 4: 空テーブルの充填（タグ・動画・関連度）

**目標**: 空テーブルにデータを埋める

#### タスク4-1: 動画データの収集

**対象テーブル**: `youtube_contents`

**実装**:
```javascript
// 既存ジョブ: fetch_recent_contents
// 全VTuberに対して実行

POST /api/admin/batch-fetch-contents
body: { limit: 100 }  // 100人ずつ
```

**期待される効果**:
- 各VTuberの直近10本の動画を取得
- 動画タイトル、説明文、再生回数などを記録

---

#### タスク4-2: AIタグ付けの実行

**対象テーブル**: `vtuber_tags`, `vtuber_tag_evidence`

**実装**:
```javascript
// 既存ジョブ: ai_tagging_vtuber
// タグ未設定のVTuberに対して実行

POST /api/admin/batch-tag
body: { limit: 10 }  // 10人ずつ（コスト管理）
```

**期待される効果**:
- 各VTuberに5〜10個のタグを自動付与
- タグの根拠（動画タイトルや説明文）を記録

---

#### タスク4-3: タグ関連度の計算

**対象テーブル**: `tag_relations`

**実装**:
```javascript
// 既存ジョブ: build_tag_relations
// 全タグに対して実行

POST /api/admin/build-tag-relations
```

**期待される効果**:
- タグ間の共起度を計算
- 「歌がうまい」と「アイドル」の関連度など

---

### Phase 5: 定期自動実行の実装

**目標**: 毎週/毎月で自動的にデータを更新

#### タスク5-1: Cron Triggerの設定

**実装**:
```toml
# wrangler.toml
[triggers]
crons = [
  "0 2 * * 0",  # 毎週日曜日 2:00 AM（新規VTuber収集）
  "0 3 * * *",  # 毎日 3:00 AM（既存VTuber更新）
]
```

**期待される効果**:
- 毎週日曜日: 新規VTuberを100件収集
- 毎日: 既存VTuberのチャンネル情報を更新（登録者数など）

---

#### タスク5-2: 自動実行ジョブの作成

**実装**:
```javascript
// src/cron/weekly-collect.js
export async function weeklyCollect(env) {
  // 新規VTuberを100件収集（date順）
  await massCollectVTubers(env, {
    targetCount: 100,
    order: 'date',  // 新しい順
  });
}

// src/cron/daily-update.js
export async function dailyUpdate(env) {
  // Tier 1（人気VTuber）のチャンネル情報を更新
  // Tier 2（中堅VTuber）は週1回
  // Tier 3（新人VTuber）は月1回
}
```

**期待される効果**:
- 新規VTuberを自動的に発見
- 既存VTuberのデータを最新に保つ

---

### Phase 6: データメンテナンスの自動化

**目標**: 空テーブルを自動的に埋める

#### タスク6-1: メンテナンスジョブの作成

**実装**:
```javascript
// 毎日実行
POST /api/admin/daily-maintenance

// 処理内容:
// 1. youtube_contentsが空のVTuberに対してfetch_recent_contentsジョブをenqueue
// 2. vtuber_tagsが空のVTuberに対してai_tagging_vtuberジョブをenqueue
// 3. tag_relationsが古い場合はbuild_tag_relationsジョブをenqueue
```

**期待される効果**:
- 空テーブルが自動的に埋まる
- データの鮮度が保たれる

---

## 📅 実装スケジュール

| Phase | タスク | 優先度 | 推定工数 | 期待される効果 |
|---|---|---|---|---|
| Phase 2 | YouTube検索の改善 | 🔴 高 | 2時間 | 新規VTuber発見率 +50% |
| Phase 2 | 重複排除の強化 | 🟡 中 | 1時間 | APIクォータ節約 |
| Phase 3 | プロダクション別メンバーリスト作成 | 🔴 高 | 4時間 | +360人 |
| Phase 3 | プロダクション別バッチ収集 | 🔴 高 | 2時間 | 全メンバー網羅 |
| Phase 4 | 動画データの収集 | 🟡 中 | 1時間 | youtube_contents充填 |
| Phase 4 | AIタグ付けの実行 | 🟡 中 | 1時間 | vtuber_tags充填 |
| Phase 4 | タグ関連度の計算 | 🟢 低 | 2時間 | tag_relations充填 |
| Phase 5 | Cron Triggerの設定 | 🟡 中 | 1時間 | 自動実行 |
| Phase 5 | 自動実行ジョブの作成 | 🟡 中 | 3時間 | 完全自動化 |
| Phase 6 | メンテナンスジョブの作成 | 🟢 低 | 2時間 | データ鮮度維持 |

**合計推定工数**: 約19時間

---

## 🎯 マイルストーン

### マイルストーン1: データ量の拡大（Phase 2-3）

**目標**: 50件 → 500件

**実施内容**:
1. YouTube検索の改善（date順）
2. プロダクション別メンバーリスト作成（ホロライブ、にじさんじ）
3. プロダクション別バッチ収集

**期待される結果**:
- ホロライブ全メンバー: 約110人
- にじさんじ全メンバー: 約150人
- 他プロダクション: 約100人
- 個人勢: 約140人
- **合計**: 約500人

---

### マイルストーン2: データの完全性（Phase 4）

**目標**: 空テーブルを埋める

**実施内容**:
1. 動画データの収集（全VTuber）
2. AIタグ付けの実行（全VTuber）
3. タグ関連度の計算

**期待される結果**:
- `youtube_contents`: 500人 × 10本 = 5,000本
- `vtuber_tags`: 500人 × 7タグ = 3,500タグ
- `vtuber_tag_evidence`: 3,500タグ × 3根拠 = 10,500根拠
- `tag_relations`: 60タグ × 5関連 = 300関連

---

### マイルストーン3: 自動化（Phase 5-6）

**目標**: 定期自動実行でメンテナンスフリー

**実施内容**:
1. Cron Triggerの設定
2. 自動実行ジョブの作成
3. メンテナンスジョブの作成

**期待される結果**:
- 毎週日曜日: 新規VTuberを100件自動収集
- 毎日: 既存VTuberのデータを自動更新
- 空テーブルを自動的に埋める

---

## 🚀 次のアクション

### 今すぐ実施（Phase 2）

1. **YouTube検索の改善**
   - `order='date'`パラメータを追加
   - 「VTuber デビュー」「新人VTuber」キーワードを追加

2. **重複排除の強化**
   - 新規チャンネルが0件のキーワードをスキップ

### 今週中に実施（Phase 3）

1. **プロダクション別メンバーリストの作成**
   - ホロライブ全メンバー（JP、EN、ID、スターズ）
   - にじさんじ全メンバー（JP、EN、ID、KR）
   - 他プロダクション（ぶいすぽ、774inc、Re:AcT、Neo-Porte、VOMS、VShojo）

2. **プロダクション別バッチ収集**
   - 管理画面に「プロダクション別収集」ボタンを追加
   - 1プロダクションずつ確実に収集

### 今月中に実施（Phase 4-6）

1. **空テーブルの充填**
2. **定期自動実行の実装**
3. **データメンテナンスの自動化**

---

## 📝 まとめ

このロードマップに従って段階的に実装することで、以下が実現されます：

1. **データ量**: 50件 → 2000件以上
2. **網羅性**: 全プロダクション・全メンバーをカバー
3. **鮮度**: 新規VTuberを自動発見（毎週）
4. **完全性**: 空テーブルを埋める
5. **自動化**: 定期実行でメンテナンスフリー

**最初のステップ**: Phase 2（YouTube検索の改善）から開始します。

---

**作成日**: 2026-01-03  
**作成者**: Manus AI
