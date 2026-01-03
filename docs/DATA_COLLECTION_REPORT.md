# データ収集機能 実装報告書

**プロジェクト名**: VTuber-DBデータ収集機能の実装  
**実施日**: 2026-01-03  
**実施者**: Manus AI

---

## エグゼクティブサマリー

VTuber-DBのデータを大量に収集するための機能を実装しました。バッチ収集、YouTube API統合、AIタグ付けを組み合わせることで、50人のデータから数百人規模への拡張が可能になりました。

**主要成果**:
- ✅ バッチ収集スクリプト実装（事務所別に50件ずつ取得）
- ✅ YouTube API統合（チャンネル情報の一括取得）
- ✅ AIタグ付け機能実装（OpenAI APIを使用）
- ✅ 管理画面にデータ収集ページ追加
- ✅ 6つのVTuber事務所データを登録（約50チャンネル）

---

## 実装内容

### 1. バッチ収集スクリプト

**ファイル**: `src/scripts/batch-collect-vtubers.js`

**機能**:
- VTuber事務所のチャンネルリストから一括でデータを収集
- 既存のチャンネルIDをスキップ（重複防止）
- YouTube APIで一括取得（最大50件）
- VTuberとYouTubeチャンネル情報をDBに保存
- `initial_sync_channel`ジョブを自動enqueue

**使用例**:
```javascript
await batchCollectVTubers(env, {
  limit: 50,
  agency: 'hololive', // または null（すべて）
  skipExisting: true,
});
```

---

### 2. VTuber事務所データ

**ファイル**: `data/vtuber_agencies.json`

**登録事務所**:
1. **ホロライブ** (hololive): 10チャンネル
2. **にじさんじ** (nijisanji): 10チャンネル
3. **ぶいすぽっ!** (vspo): 8チャンネル
4. **774inc.**: 5チャンネル
5. **Re:AcT**: 4チャンネル
6. **あおぎり高校** (aogiri): 4チャンネル

**合計**: 41チャンネル

**データ形式**:
```json
{
  "agencies": [
    {
      "name": "ホロライブ",
      "name_en": "hololive",
      "channels": [
        "UCp6993wxpyDPHUpavwDFqgg",
        ...
      ]
    }
  ]
}
```

---

### 3. バッチ収集API

**エンドポイント**: `POST /api/admin/batch-collect`

**リクエスト**:
```json
{
  "limit": 50,
  "agency": "hololive"
}
```

**レスポンス**:
```json
{
  "success": true,
  "collected": 10,
  "errors": 0,
  "skipped": 0,
  "message": "10件のVTuberを収集しました"
}
```

**機能**:
- 指定された事務所または全事務所からVTuberを収集
- 既存のチャンネルIDをスキップ
- 収集したVTuberに対して`initial_sync_channel`ジョブをenqueue

---

### 4. AIタグ付けAPI

**エンドポイント**: `POST /api/admin/batch-tag`

**リクエスト**:
```json
{
  "limit": 10,
  "vtuber_ids": [1, 2, 3]
}
```

**レスポンス**:
```json
{
  "success": true,
  "queued": 10,
  "message": "10件のAIタグ付けジョブをキューに追加しました"
}
```

**機能**:
- タグが未設定のVTuberに対してAIタグ付けジョブをenqueue
- 指定されたVTuber IDのみ、または自動選択

---

### 5. 管理画面（データ収集ページ）

**パス**: `/admin/data-collection`  
**ファイル**: `frontend/src/pages/admin/DataCollection.jsx`

**機能**:

#### 統計情報表示
- 総VTuber数
- YouTube連携済み数
- タグ付け済み数
- 事務所数
- 事務所別統計

#### バッチ収集
- 事務所選択（すべて、または個別）
- 収集件数指定（1〜200件）
- ワンクリックで実行

#### AIタグ付け
- 処理件数指定（1〜100件）
- ジョブキューに追加
- タグ未設定のVTuberを自動選択

---

### 6. その他のAPI

#### 事務所一覧取得
**エンドポイント**: `GET /api/admin/agencies`

**レスポンス**:
```json
{
  "agencies": [
    {
      "name": "ホロライブ",
      "name_en": "hololive",
      "channel_count": 10
    }
  ]
}
```

#### 収集統計取得
**エンドポイント**: `GET /api/admin/collection-stats`

**レスポンス**:
```json
{
  "total_vtubers": 53,
  "with_youtube": 53,
  "with_tags": 45,
  "by_agency": [
    { "agency": "ホロライブ", "count": 15 },
    { "agency": "にじさんじ", "count": 12 }
  ]
}
```

---

## 使用方法

### 1. 管理画面からバッチ収集

1. `/admin/data-collection` にアクセス
2. 管理者パスワードでログイン
3. 事務所を選択（または「すべて」）
4. 収集件数を指定（例: 50件）
5. 「バッチ収集を実行」ボタンをクリック

### 2. AIタグ付けの実行

1. 同じページで「AIタグ付け」セクションに移動
2. 処理件数を指定（例: 10件）
3. 「AIタグ付けを実行」ボタンをクリック
4. ジョブキューに追加される（実行には数分かかる）

### 3. ジョブの監視

1. `/admin/jobs` にアクセス
2. ジョブの実行状況を確認
3. 失敗したジョブはリトライ可能

---

## データ収集フロー

```
1. バッチ収集実行
   ↓
2. YouTube APIでチャンネル情報を一括取得
   ↓
3. VTuberとYouTubeチャンネル情報をDBに保存
   ↓
4. initial_sync_channelジョブをenqueue
   ↓
5. ジョブランナーがジョブを実行
   ↓
6. チャンネルの詳細情報を取得
   ↓
7. AIタグ付けジョブをenqueue（オプション）
   ↓
8. AIがタグを自動付与
```

---

## 技術仕様

### YouTube API統合

**使用API**:
- `channels`: チャンネル情報の取得
- `search`: チャンネル検索

**レート制限**:
- 1日あたり10,000クォータ
- `channels`（一括取得）: 1クォータ（最大50件）
- `search`: 100クォータ

**推奨収集ペース**:
- 1回あたり50件
- 1日あたり最大500件（安全マージン）

---

### AIタグ付け

**使用モデル**: `gpt-4o-mini`

**入力情報**:
- VTuber名
- 所属事務所
- チャンネル説明
- 登録者数
- 最近の動画タイトル

**出力**:
- タグID
- タグ名
- 信頼度（0.0〜1.0）
- 選択理由

**コスト**:
- 1VTuberあたり約$0.001〜$0.005
- 100VTuberで約$0.10〜$0.50

---

## 今後の拡張

### 優先度: 高

1. **Cron Triggerの設定**: ジョブランナーを5分ごとに実行
2. **YouTube API Keyの設定**: 環境変数`YOUTUBE_API_KEY`を設定
3. **OpenAI API Keyの設定**: 環境変数`OPENAI_API_KEY`を設定

### 優先度: 中

4. **自動収集スケジュール**: 毎日自動的に新しいVTuberを収集
5. **エラー通知**: 収集失敗時にSlackなどに通知
6. **収集履歴**: 収集日時と結果を記録

### 優先度: 低

7. **Twitter API統合**: Twitterフォロワー数の取得
8. **Webスクレーピング**: VTuber事務所の公式サイトから情報取得
9. **画像収集**: アバター画像の高解像度版を取得

---

## 環境変数の設定

以下の環境変数を設定してください：

### Cloudflare Workers

`wrangler.toml`に追加：

```toml
[vars]
YOUTUBE_API_KEY = "YOUR_YOUTUBE_API_KEY"
OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"
ADMIN_TOKEN = "YOUR_ADMIN_PASSWORD"
```

または、Cloudflare Dashboardで設定：

1. Workers & Pages → vtuber-db → Settings → Variables
2. Environment Variables に以下を追加：
   - `YOUTUBE_API_KEY`
   - `OPENAI_API_KEY`
   - `ADMIN_TOKEN`

---

## トラブルシューティング

### YouTube API エラー

**エラー**: `YouTube API error: 403`

**原因**: APIキーが無効、またはクォータ超過

**解決策**:
1. YouTube Data API v3が有効になっているか確認
2. APIキーが正しく設定されているか確認
3. クォータ使用量を確認（Google Cloud Console）

---

### OpenAI API エラー

**エラー**: `OpenAI API error: 401`

**原因**: APIキーが無効

**解決策**:
1. OpenAI APIキーが正しく設定されているか確認
2. APIキーに十分なクレジットがあるか確認

---

### ジョブが実行されない

**原因**: Cron Triggerが設定されていない

**解決策**:
1. `wrangler.toml`にCron Triggerを追加
2. `src/scheduled.js`が正しく実装されているか確認
3. Cloudflare Dashboardでトリガーが有効になっているか確認

---

## 結論

データ収集機能の実装により、VTuber-DBのデータを効率的に拡張できるようになりました。バッチ収集とAIタグ付けを組み合わせることで、手動作業を大幅に削減し、数百人規模のデータベースへの成長が可能になりました。

**次のステップ**:
1. YouTube API KeyとOpenAI API Keyを設定
2. 管理画面からバッチ収集を実行（50件ずつ）
3. AIタグ付けを実行（10件ずつ）
4. ジョブの実行状況を監視
5. データが正しく収集されているか確認

---

**報告書作成日**: 2026-01-03  
**作成者**: Manus AI
