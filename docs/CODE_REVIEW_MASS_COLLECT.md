# コードレビュー: 大規模収集機能

**レビュー日**: 2026-01-03  
**レビュー対象**: `src/scripts/mass-collect-vtubers.js`  
**レビュアー**: Manus AI

---

## 📋 レビュー概要

大規模収集機能のコードレビューを実施しました。特にレート制限対策と重複スキップのロジックを重点的に確認しました。

**総合評価**: ⭐⭐⭐⭐☆ (4/5)

---

## ✅ 良い点

### 1. 重複スキップのロジック

**実装箇所**: 57-64行目、83-85行目

```javascript
// 既存のチャンネルIDを取得
let existingChannelIds = new Set();
if (skipExisting) {
  const { results } = await db
    .prepare('SELECT channel_id FROM youtube_channels')
    .all();
  existingChannelIds = new Set(results.map(r => r.channel_id));
}

// 新規チャンネルのみフィルタ
const newChannels = channels.filter(
  ch => !existingChannelIds.has(ch.channel_id) && !collectedChannelIds.has(ch.channel_id)
);
```

**評価**: ✅ **優秀**

- `Set`を使用しているため、O(1)の高速な重複チェック
- `existingChannelIds`（DB内の既存データ）と`collectedChannelIds`（今回収集したデータ）の両方をチェック
- 完全な重複防止が実現されている

---

### 2. レート制限対策

**実装箇所**: 163-164行目

```javascript
// レート制限対策（1秒待機）
await new Promise(resolve => setTimeout(resolve, 1000));
```

**評価**: ✅ **適切**

- 各キーワード検索の間に1秒待機
- YouTube APIのレート制限（毎秒10リクエスト）を考慮した実装

---

### 3. エラーハンドリング

**実装箇所**: 157-160行目、165-168行目

```javascript
try {
  // VTuberを作成
  ...
} catch (error) {
  console.error(`[Mass Collect] Error collecting ${channelInfo.channel_name}:`, error);
  totalErrors++;
}
```

**評価**: ✅ **堅牢**

- 個別のチャンネル収集エラーでも処理を継続
- エラーカウントを記録
- ログ出力で問題を追跡可能

---

### 4. 目標件数の制御

**実装箇所**: 72-74行目、102-104行目

```javascript
if (totalCollected >= targetCount) {
  break;
}
```

**評価**: ✅ **正確**

- 2箇所でチェック（キーワードループと個別収集）
- 目標件数を超えないように制御

---

## ⚠️ 改善が必要な点

### 1. レート制限対策が不十分

**問題**: 1秒待機は`searchChannels`と`getBatchChannelInfo`の間にない

**現在の実装**:
```javascript
const channels = await youtubeService.searchChannels(keyword, 50);  // API呼び出し1
const channelsInfo = await youtubeService.getBatchChannelInfo(channelIds);  // API呼び出し2（すぐ実行）
await new Promise(resolve => setTimeout(resolve, 1000));  // 待機（次のキーワードまで）
```

**問題点**:
- `searchChannels`と`getBatchChannelInfo`が連続で実行される
- YouTube APIのレート制限（毎秒10リクエスト）に抵触する可能性がある

**推奨修正**:
```javascript
const channels = await youtubeService.searchChannels(keyword, 50);
await new Promise(resolve => setTimeout(resolve, 200));  // 200ms待機

const channelsInfo = await youtubeService.getBatchChannelInfo(channelIds);
await new Promise(resolve => setTimeout(resolve, 1000));  // 1秒待機
```

**重要度**: 🔴 **高**

---

### 2. DB書き込みのトランザクション未使用

**問題**: 各チャンネルごとに3回のDB書き込み（vtubers、youtube_channels、jobs）が個別に実行される

**現在の実装**:
```javascript
await db.prepare(`INSERT INTO vtubers ...`).run();
await db.prepare(`INSERT INTO youtube_channels ...`).run();
await db.prepare(`INSERT INTO jobs ...`).run();
```

**問題点**:
- 途中でエラーが発生すると、データの整合性が崩れる可能性
- パフォーマンスが低下（1000件で3000回のDB書き込み）

**推奨修正**:
```javascript
await db.batch([
  db.prepare(`INSERT INTO vtubers ...`).bind(...),
  db.prepare(`INSERT INTO youtube_channels ...`).bind(...),
  db.prepare(`INSERT INTO jobs ...`).bind(...),
]);
```

**重要度**: 🟡 **中**

---

### 3. YouTubeService のエラーハンドリング

**問題**: `youtubeService.searchChannels`や`getBatchChannelInfo`がエラーを投げた場合、そのキーワードがスキップされる

**現在の実装**:
```javascript
try {
  const channels = await youtubeService.searchChannels(keyword, 50);
  ...
} catch (error) {
  console.error(`[Mass Collect] Error searching for ${keyword}:`, error);
  totalErrors++;
}
```

**問題点**:
- APIエラー（403 Forbidden、429 Too Many Requests）の種類によって対応を変えるべき
- クォータ超過時は即座に停止すべき

**推奨修正**:
```javascript
try {
  const channels = await youtubeService.searchChannels(keyword, 50);
  ...
} catch (error) {
  console.error(`[Mass Collect] Error searching for ${keyword}:`, error);
  
  // クォータ超過時は即座に停止
  if (error.message.includes('403') || error.message.includes('quotaExceeded')) {
    console.error('[Mass Collect] Quota exceeded. Stopping collection.');
    break;
  }
  
  totalErrors++;
}
```

**重要度**: 🟡 **中**

---

### 4. メモリ使用量の最適化

**問題**: `existingChannelIds`が全チャンネルIDをメモリに保持

**現在の実装**:
```javascript
const { results } = await db
  .prepare('SELECT channel_id FROM youtube_channels')
  .all();
existingChannelIds = new Set(results.map(r => r.channel_id));
```

**問題点**:
- 2000件のチャンネルIDをメモリに保持（約100KB）
- 将来的に10,000件になると約500KB

**推奨修正**:
- 現状は問題ないが、将来的にはDB側で重複チェック（`INSERT IGNORE`など）を検討

**重要度**: 🟢 **低**

---

### 5. ログ出力の改善

**問題**: 進捗状況が分かりにくい

**現在の実装**:
```javascript
console.log(`[Mass Collect] Collected: ${channelInfo.channel_name} (${totalCollected}/${targetCount})`);
```

**推奨修正**:
```javascript
console.log(`[Mass Collect] Progress: ${totalCollected}/${targetCount} (${Math.floor(totalCollected / targetCount * 100)}%) - ${channelInfo.channel_name}`);
```

**重要度**: 🟢 **低**

---

## 🔧 修正版コード

### 修正1: レート制限対策の強化

```javascript
// YouTube検索（最大50件）
const channels = await youtubeService.searchChannels(keyword, 50);

// API呼び出し間隔を確保
await new Promise(resolve => setTimeout(resolve, 200));

// 新規チャンネルのみフィルタ
const newChannels = channels.filter(
  ch => !existingChannelIds.has(ch.channel_id) && !collectedChannelIds.has(ch.channel_id)
);

if (newChannels.length === 0) {
  console.log(`[Mass Collect] No new channels found for: ${keyword}`);
  continue;
}

console.log(`[Mass Collect] Found ${newChannels.length} new channels for: ${keyword}`);

// チャンネルIDを収集
const channelIds = newChannels.map(ch => ch.channel_id);

// 詳細情報を一括取得
const channelsInfo = await youtubeService.getBatchChannelInfo(channelIds);

// レート制限対策（1秒待機）
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

### 修正2: クォータ超過時の即座停止

```javascript
try {
  // YouTube検索（最大50件）
  const channels = await youtubeService.searchChannels(keyword, 50);
  
  // API呼び出し間隔を確保
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // ...（省略）
  
} catch (error) {
  console.error(`[Mass Collect] Error searching for ${keyword}:`, error);
  
  // クォータ超過時は即座に停止
  if (error.message.includes('403') || error.message.includes('quotaExceeded')) {
    console.error('[Mass Collect] Quota exceeded. Stopping collection.');
    break;
  }
  
  totalErrors++;
}
```

---

### 修正3: トランザクションの使用

```javascript
try {
  // トランザクションで一括実行
  await db.batch([
    db.prepare(`
      INSERT INTO vtubers (name, name_en, avatar_url, sync_tier, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      channelInfo.channel_name,
      channelInfo.custom_url || channelInfo.channel_name,
      channelInfo.thumbnail_url,
      3,
      channelInfo.description?.substring(0, 500) || null
    ),
    db.prepare(`
      INSERT INTO youtube_channels (vtuber_id, channel_id, channel_name, subscriber_count, view_count, video_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      vtuberId,
      channelInfo.channel_id,
      channelInfo.channel_name,
      channelInfo.subscriber_count,
      channelInfo.view_count,
      channelInfo.video_count
    ),
    db.prepare(`
      INSERT INTO jobs (job_type, payload, priority)
      VALUES (?, ?, ?)
    `).bind(
      'initial_sync_channel',
      JSON.stringify({ vtuber_id: vtuberId, channel_id: channelInfo.channel_id }),
      3
    ),
  ]);

  collectedChannelIds.add(channelInfo.channel_id);
  totalCollected++;

  console.log(`[Mass Collect] Progress: ${totalCollected}/${targetCount} (${Math.floor(totalCollected / targetCount * 100)}%) - ${channelInfo.channel_name}`);
} catch (error) {
  console.error(`[Mass Collect] Error collecting ${channelInfo.channel_name}:`, error);
  totalErrors++;
}
```

---

## 📊 修正の優先度

| 修正項目 | 重要度 | 影響範囲 | 推奨対応時期 |
|---|---|---|---|
| レート制限対策の強化 | 🔴 高 | API呼び出し | 即座 |
| クォータ超過時の停止 | 🟡 中 | エラーハンドリング | 1週間以内 |
| トランザクションの使用 | 🟡 中 | DB書き込み | 1週間以内 |
| ログ出力の改善 | 🟢 低 | ユーザー体験 | 1ヶ月以内 |
| メモリ使用量の最適化 | 🟢 低 | パフォーマンス | 将来的に |

---

## 🎯 結論

### 現状の評価

**総合評価**: ⭐⭐⭐⭐☆ (4/5)

- 重複スキップのロジックは優秀
- 基本的なレート制限対策は実装されている
- エラーハンドリングは堅牢

### 推奨される対応

1. **即座に修正**: レート制限対策の強化（200ms待機を追加）
2. **1週間以内**: クォータ超過時の即座停止、トランザクションの使用
3. **将来的に**: ログ出力の改善、メモリ使用量の最適化

### 運用上の注意

- 初回実行時は**500件**から開始し、動作を確認
- YouTube APIのクォータ使用量を監視
- エラーログを定期的に確認

---

**レビュー完了日**: 2026-01-03  
**レビュアー**: Manus AI
