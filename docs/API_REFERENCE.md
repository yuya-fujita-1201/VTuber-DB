# VTuber-DB API リファレンス

**バージョン**: 2.0  
**ベースURL**: `https://vtuber-db.example.com/api`

## 認証

公開APIは認証不要です。管理APIは`Authorization: Bearer <token>`ヘッダーが必要です。

## エンドポイント一覧

### VTuber

#### `GET /api/vtubers/:id` - VTuber詳細取得

特定のVTuberの詳細情報を取得します。

**パラメータ:**
- `id` (path, required): VTuber ID

**レスポンス例:**
```json
{
  "id": 1,
  "name": "ときのそら",
  "name_en": "Tokino Sora",
  "agency": "ホロライブ",
  "avatar_url": "https://...",
  "youtube": {
    "channel_id": "UCp6993wxpyDPHUpavwDFqgg",
    "subscriber_count": 1000000
  },
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
      "avatar_url": "https://...",
      "subscriber_count": 2000000,
      "common_tags": 5
    }
  ]
}
```

---

### 検索

#### `GET /api/search` - VTuber検索

キーワードやタグでVTuberを検索します。

**クエリパラメータ:**
- `q` (string): 検索キーワード
- `tags` (string): タグIDをカンマ区切り（例: `1,2,3`）。**子孫タグも自動的に検索対象**になります。
- `agency` (string): 所属事務所
- `min_subscribers` (integer): 最小登録者数
- `max_subscribers` (integer): 最大登録者数
- `sort` (string): ソート順（`subscribers`, `name`, `debut`）
- `limit` (integer): 取得件数（デフォルト: 50）
- `offset` (integer): オフセット（デフォルト: 0）

**レスポンス例:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "ときのそら",
      "avatar_url": "https://...",
      "youtube_subscribers": 1000000
    }
  ],
  "suggested_tags": [
    {
      "id": 10,
      "name": "歌がうまい",
      "slug": "singing",
      "weight": 0.7
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100
  }
}
```

---

### タグ

#### `GET /api/tags` - タグ一覧取得

すべてのタグをフラットに取得します。

**レスポンス例:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "エンタメ",
      "slug": "entertainment",
      "category": "content",
      "parent_id": null
    }
  ]
}
```

---

#### `GET /api/tags/tree` - タグ階層取得

すべてのタグを階層構造で取得します。

**レスポンス例:**
```json
{
  "tags": [
    {
      "id": 1,
      "name": "エンタメ",
      "slug": "entertainment",
      "parent_id": null,
      "child_count": 3,
      "vtuber_count": 50,
      "children": [
        {
          "id": 2,
          "name": "ゲーム実況",
          "slug": "gaming",
          "parent_id": 1,
          "child_count": 2,
          "vtuber_count": 30,
          "children": []
        }
      ]
    }
  ]
}
```

---

#### `GET /api/tags/:slug` - タグ詳細取得

特定のタグの詳細情報を取得します。

**パラメータ:**
- `slug` (path, required): タグのslug（例: `gaming`）

**レスポンス例:**
```json
{
  "tag": {
    "id": 2,
    "name": "ゲーム実況",
    "slug": "gaming",
    "description": "ゲームをプレイしながら実況する配信スタイル",
    "category": "content",
    "parent": {
      "id": 1,
      "name": "エンタメ",
      "slug": "entertainment"
    },
    "children": [
      {
        "id": 10,
        "name": "FPS",
        "slug": "fps"
      }
    ],
    "related_tags": [
      {
        "id": 11,
        "name": "歌がうまい",
        "slug": "singing",
        "relation_type": "cooccurrence",
        "weight": 0.7
      }
    ],
    "vtubers": [
      {
        "id": 1,
        "name": "ときのそら",
        "avatar_url": "https://...",
        "score": 0.95
      }
    ]
  }
}
```

---

### データ投入

#### `POST /api/ingestion-requests` - データ追加リクエスト

ユーザーが新しいVTuberの追加をリクエストします。

**リクエストボディ:**
```json
{
  "url": "https://www.youtube.com/@tokino_sora"
}
```

**レスポンス例:**
```json
{
  "success": true,
  "request_id": 123,
  "message": "リクエストを受け付けました。処理には数分かかる場合があります。"
}
```

---

### 管理API（認証必要）

#### `GET /api/admin/jobs` - ジョブ一覧取得

**ヘッダー:**
- `Authorization: Bearer <token>`

**クエリパラメータ:**
- `status` (string): ステータスフィルター（`queued`, `running`, `success`, `failed`）
- `job_type` (string): ジョブタイプフィルター

**レスポンス例:**
```json
[
  {
    "id": 1,
    "job_type": "resolve_channel",
    "status": "success",
    "priority": 5,
    "attempts": 1,
    "created_at": "2026-01-03T12:00:00Z",
    "completed_at": "2026-01-03T12:01:00Z"
  }
]
```

---

#### `GET /api/admin/ingestion-requests` - 投入リクエスト一覧取得

**ヘッダー:**
- `Authorization: Bearer <token>`

**クエリパラメータ:**
- `status` (string): ステータスフィルター（`queued`, `resolved`, `rejected`, `duplicate`）

**レスポンス例:**
```json
[
  {
    "id": 1,
    "requested_url": "https://www.youtube.com/@tokino_sora",
    "status": "resolved",
    "created_at": "2026-01-03T12:00:00Z"
  }
]
```

---

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "error": "エラーの種類",
  "message": "詳細なエラーメッセージ"
}
```

**HTTPステータスコード:**
- `400`: Bad Request（不正なリクエスト）
- `401`: Unauthorized（認証エラー）
- `404`: Not Found（リソースが見つからない）
- `500`: Internal Server Error（サーバーエラー）
