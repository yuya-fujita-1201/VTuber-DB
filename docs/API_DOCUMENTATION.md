> **Note:** このドキュメントは改修後のAPI仕様を記述します。Kamui-4D実装分は仮置きです。

# VTuber-DB API ドキュメント

## 1. 認証

- **APIキー**: 不要（公開API）
- **レートリミット**: 未実装（Cloudflareによる）

## 2. エンドポイント

### 2.1. VTuber

#### `GET /api/vtubers/:id` - VTuber詳細取得

特定のVTuberの詳細情報を取得します。

**レスポンスの拡張:**

- `tags` オブジェクトに `score`, `evidence_count`, `evidence` を追加
- `similar_vtubers` オブジェクトを追加

**レスポンス例 (抜粋):**

```json
{
  "id": 1,
  "name": "ときのそら",
  "tags": [
    {
      "id": 1,
      "name": "可愛い系",
      "slug": "kawaii",
      "score": 0.95,
      "confidence": 0.9,
      "evidence_count": 3,
      "is_verified": 1,
      "evidence": [
        {
          "platform": "youtube",
          "content_id": "video123",
          "evidence_type": "title",
          "snippet": "かわいい歌声で...",
          "weight": 0.9
        }
      ]
    }
  ],
  "similar_vtubers": [
    {
      "id": 2,
      "name": "星街すいせい",
      "avatar_url": "...",
      "subscriber_count": 2000000,
      "common_tags": 5
    }
  ]
}
```

---

### 2.2. 検索

#### `GET /api/search` - VTuber検索

キーワードやタグでVTuberを検索します。

**クエリパラメータ:**

- `tags` (string): タグIDをカンマ区切りで指定。**子孫タグも自動的に検索対象**になります。

**レスポンスの拡張:**

- `suggested_tags` オブジェクトを追加

**レスポンス例 (抜粋):**

```json
{
  "data": [...],
  "suggested_tags": [
    {
      "id": 10,
      "name": "歌がうまい",
      "slug": "singing",
      "weight": 0.7
    }
  ],
  "pagination": {...}
}
```

---

### 2.3. タグ (新規 - Kamui-4D担当)

#### `GET /api/tags/tree` - タグ階層取得

すべてのタグを階層構造で取得します。

#### `GET /api/tags/:slug` - タグ詳細取得

特定のタグの詳細情報（関連タグ、同義語など）を取得します。

---

### 2.4. データ投入 (新規 - Kamui-4D担当)

#### `POST /api/ingestion-requests` - データ追加リクエスト

ユーザーが新しいVTuberの追加をリクエストします。
