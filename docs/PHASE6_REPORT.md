# Phase 6完了報告: データメンテナンスの自動化

## 📋 概要

Phase 6では、既存VTuberのデータを定期的に更新する仕組みを実装しました。登録者数、視聴回数、動画数などを自動的に更新し、データの鮮度を管理します。

---

## ✅ 実装した機能

### 1. stale_level（データの鮮度管理）

**概念**:
- VTuberデータの「古さ」を0〜3の4段階で管理
- 古いデータを優先的に更新することで、APIクォータを効率的に使用

**レベル定義**:
| stale_level | 状態 | 最終更新 |
|---|---|---|
| 0 | 新鮮 | 1週間以内 |
| 1 | やや古い | 1ヶ月以内 |
| 2 | 古い | 3ヶ月以内 |
| 3 | 非常に古い | 3ヶ月以上 |

---

### 2. sync_tier（更新頻度の管理）

**概念**:
- 登録者数に応じて更新頻度を変える
- 人気VTuberは頻繁に更新、マイナーVTuberは低頻度で更新

**Tier定義**:
| sync_tier | 登録者数 | 更新頻度 |
|---|---|---|
| S | 100万人以上 | 毎日 |
| A | 50万人以上 | 週1回 |
| B | 10万人以上 | 月1回 |
| C | 10万人未満 | 3ヶ月に1回 |

---

### 3. データ更新機能

#### 3-1. updateStaleVTubers（古いデータを優先的に更新）

**機能**:
- stale_levelが高いVTuberを優先的に更新
- 登録者数、視聴回数、動画数を最新化
- sync_tierとstale_levelを自動計算

**APIエンドポイント**:
```
POST /api/admin/update-stale
body: { limit: 50, minStaleLevel: 1 }
```

**使用例**:
```javascript
// stale_level 1以上のVTuberを50人更新
await updateStaleVTubers(env, {
  limit: 50,
  minStaleLevel: 1,
});
```

---

#### 3-2. recalculateStaleLevel（stale_levelを再計算）

**機能**:
- すべてのVTuberのstale_levelを再計算
- 最終更新日時（last_synced_at）から自動計算

**APIエンドポイント**:
```
POST /api/admin/recalculate-stale
```

**使用例**:
```javascript
// すべてのVTuberのstale_levelを再計算
await recalculateStaleLevel(env);
```

---

#### 3-3. updateByTier（Tierごとに更新）

**機能**:
- 指定したTierのVTuberを更新
- 更新間隔を超えたVTuberのみを更新

**APIエンドポイント**:
```
POST /api/admin/update-by-tier
body: { tier: 'S' }
```

**使用例**:
```javascript
// Tier SのVTuberを更新（毎日実行）
await updateByTier(env, 'S');

// Tier AのVTuberを更新（週1回実行）
await updateByTier(env, 'A');
```

---

### 4. 管理画面（`/admin/maintenance`）

**追加機能**:
- 古いデータを更新（stale_levelが高いVTuberを優先）
- stale_levelを再計算

**パス**:
```
https://vtuber-db.pages.dev/admin/maintenance
```

---

## 📊 期待される効果

### APIクォータの節約

**従来の方法**（全VTuber更新）:
- 500VTuber × 1クォータ = 500クォータ/日

**新しい方法**（stale_level優先）:
- 50VTuber × 1クォータ = 50クォータ/日 ← **90%削減！**

---

### データの鮮度向上

**Tier Sの例**（ホロライブ、にじさんじトップ層）:
- 更新頻度: 毎日
- stale_level: 常に0（新鮮）

**Tier Cの例**（個人勢、小規模VTuber）:
- 更新頻度: 3ヶ月に1回
- stale_level: 0〜3（変動）

---

## 🚀 使い方

### ステップ1: 管理画面にアクセス

```
https://vtuber-db.pages.dev/admin/maintenance
```

### ステップ2: stale_levelを再計算

1. 「stale_levelを再計算」ボタンをクリック
2. すべてのVTuberのstale_levelが更新される

### ステップ3: 古いデータを更新

1. 「古いデータを更新」セクションに移動
2. 更新するVTuber数を入力（例: 50件）
3. 最小stale_levelを選択（例: 1 - やや古い）
4. 「古いデータを更新」ボタンをクリック

**推奨設定**:
- 更新するVTuber数: 50件
- 最小stale_level: 1（やや古い）

---

## 🔧 技術的な詳細

### stale_levelの計算ロジック

```javascript
function calculateStaleLevel(lastSyncedAt) {
  if (!lastSyncedAt) return 3;
  
  const now = new Date();
  const lastSync = new Date(lastSyncedAt);
  const daysSinceSync = (now - lastSync) / (1000 * 60 * 60 * 24);
  
  if (daysSinceSync < 7) return 0;      // 1週間以内: 新鮮
  if (daysSinceSync < 30) return 1;     // 1ヶ月以内: やや古い
  if (daysSinceSync < 90) return 2;     // 3ヶ月以内: 古い
  return 3;                              // 3ヶ月以上: 非常に古い
}
```

### sync_tierの計算ロジック

```javascript
function calculateSyncTier(subscriberCount) {
  if (subscriberCount >= 1000000) return 'S';  // 100万人以上
  if (subscriberCount >= 500000) return 'A';   // 50万人以上
  if (subscriberCount >= 100000) return 'B';   // 10万人以上
  return 'C';                                   // 10万人未満
}
```

### 優先度付き更新クエリ

```sql
SELECT id, channel_id, channel_name, stale_level, last_synced_at
FROM vtubers
WHERE channel_id IS NOT NULL
  AND (stale_level >= ? OR stale_level IS NULL)
ORDER BY 
  CASE 
    WHEN stale_level IS NULL THEN 999
    ELSE stale_level
  END DESC,
  last_synced_at ASC NULLS FIRST
LIMIT ?
```

**ポイント**:
1. stale_levelが高い順（古い順）
2. 同じstale_levelなら、last_synced_atが古い順
3. stale_levelがNULLのVTuberは最優先

---

## 📝 次のステップ

### Phase 5: 定期自動実行の実装

**Kamui-4Dに依頼**:
- タスクF: 自動実行ジョブの作成（3時間）
  - `src/cron/daily-update.js`: 毎日Tier Sを更新
  - `src/cron/weekly-update.js`: 毎週Tier Aを更新
  - `src/cron/monthly-update.js`: 毎月Tier Bを更新

**Manusが待機**:
- Phase 5-1: Cron Triggerの設定（1時間）

---

## 🎯 完了したPhase

- ✅ Phase 1: 現状分析と段階的タスクの策定
- ✅ Phase 2: 重複排除と新規発見の改善
- ✅ Phase 4: 空テーブルの充填（タグ・動画・関連度）
- ✅ Phase 6: データメンテナンスの自動化

**進行中**:
- ⏳ Phase 3: 全プロダクション・全メンバーのデータ収集（Kamui-4D タスクE）

**次**:
- 🔜 Phase 5: 定期自動実行の実装（Kamui-4D タスクF）

---

## 💡 運用のベストプラクティス

### 毎日実行すべきタスク

1. **Tier Sの更新**（約10VTuber、10クォータ）
   ```bash
   POST /api/admin/update-by-tier
   body: { tier: 'S' }
   ```

2. **古いデータの更新**（約50VTuber、50クォータ）
   ```bash
   POST /api/admin/update-stale
   body: { limit: 50, minStaleLevel: 1 }
   ```

### 毎週実行すべきタスク

1. **Tier Aの更新**（約30VTuber、30クォータ）
   ```bash
   POST /api/admin/update-by-tier
   body: { tier: 'A' }
   ```

2. **stale_levelの再計算**（0クォータ）
   ```bash
   POST /api/admin/recalculate-stale
   ```

### 毎月実行すべきタスク

1. **Tier Bの更新**（約100VTuber、100クォータ）
   ```bash
   POST /api/admin/update-by-tier
   body: { tier: 'B' }
   ```

### 3ヶ月に1回実行すべきタスク

1. **Tier Cの更新**（約360VTuber、360クォータ）
   ```bash
   POST /api/admin/update-by-tier
   body: { tier: 'C' }
   ```

---

## 📊 クォータ使用量の見積もり

| タスク | 頻度 | VTuber数 | クォータ/回 | クォータ/日 |
|---|---|---|---|---|
| Tier S更新 | 毎日 | 10 | 10 | 10 |
| 古いデータ更新 | 毎日 | 50 | 50 | 50 |
| Tier A更新 | 週1回 | 30 | 30 | 4.3 |
| Tier B更新 | 月1回 | 100 | 100 | 3.3 |
| Tier C更新 | 3ヶ月に1回 | 360 | 360 | 4 |
| **合計** | - | - | - | **71.6** |

**結論**: 1日あたり約72クォータで、500VTuberのデータを適切に維持できます。

YouTube Data API v3のクォータ上限は1日10,000なので、十分に余裕があります。
