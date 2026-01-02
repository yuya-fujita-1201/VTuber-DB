# デプロイガイド

このガイドでは、VTuber DatabaseをCloudflareにデプロイする手順を説明します。

## 前提条件

- Cloudflareアカウント
- Wrangler CLI（`npm install -g wrangler`）
- 各種APIキー（YouTube、Twitter、Twitch、OpenAI）

## 手順

### 1. Cloudflareにログイン

```bash
wrangler login
```

ブラウザが開き、Cloudflareアカウントでログインします。

### 2. D1データベースの作成

```bash
# D1データベースを作成
wrangler d1 create vtuber-db
```

出力されたデータベースIDをコピーし、`wrangler.toml`の`database_id`に設定します。

```toml
[[d1_databases]]
binding = "DB"
database_name = "vtuber-db"
database_id = "ここにデータベースIDを貼り付け"
```

### 3. データベーススキーマの適用

```bash
# 本番環境にスキーマを適用
wrangler d1 execute vtuber-db --remote --file=./schema/schema.sql

# 初期タグデータを投入
wrangler d1 execute vtuber-db --remote --file=./schema/seed_tags.sql
```

### 4. R2バケットの作成（画像保存用）

```bash
wrangler r2 bucket create vtuber-images
```

### 5. KVネームスペースの作成（キャッシュ用）

```bash
wrangler kv:namespace create "CACHE"
```

出力されたIDを`wrangler.toml`の`id`に設定します。

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "ここにKV IDを貼り付け"
```

### 6. 環境変数（Secrets）の設定

```bash
# YouTube API Key
wrangler secret put YOUTUBE_API_KEY

# Twitter Bearer Token
wrangler secret put TWITTER_BEARER_TOKEN

# Twitch Client ID
wrangler secret put TWITCH_CLIENT_ID

# Twitch Client Secret
wrangler secret put TWITCH_CLIENT_SECRET

# OpenAI API Key
wrangler secret put OPENAI_API_KEY

# 管理者パスワード
wrangler secret put ADMIN_PASSWORD
```

各コマンド実行後、プロンプトでシークレット値を入力します。

### 7. Workersのデプロイ

```bash
# バックエンドをデプロイ
wrangler deploy
```

デプロイが成功すると、Workers URLが表示されます（例：`https://vtuber-db.your-subdomain.workers.dev`）。

### 8. フロントエンドのビルド

```bash
cd frontend
npm install
npm run build
```

`frontend/dist`ディレクトリにビルド成果物が生成されます。

### 9. Cloudflare Pagesへのデプロイ

#### 方法1: Cloudflare Dashboard経由

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にログイン
2. 「Pages」セクションに移動
3. 「Create a project」をクリック
4. GitHubリポジトリを接続
5. ビルド設定:
   - **Framework preset**: Vite
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
6. 環境変数を設定（必要に応じて）
7. 「Save and Deploy」をクリック

#### 方法2: Wrangler CLI経由

```bash
cd frontend
wrangler pages deploy dist --project-name=vtuber-db
```

### 10. カスタムドメインの設定（オプション）

Cloudflare Pagesのダッシュボードから、カスタムドメインを設定できます。

1. Pagesプロジェクトの設定に移動
2. 「Custom domains」タブを選択
3. ドメインを追加し、DNS設定を行う

### 11. Cron Triggersの設定（定期実行）

`wrangler.toml`にCron設定を追加します：

```toml
[triggers]
crons = [
  "0 */6 * * *",  # 6時間ごと
]
```

Cronハンドラーを`src/index.js`に追加：

```javascript
export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  
  async scheduled(event, env, ctx) {
    // 定期実行タスク
    console.log('Running scheduled tasks...');
    
    // データ同期
    await syncYouTubeData(env);
    await syncTwitterData(env);
    await syncTwitchData(env);
    
    // AIタグづけ（1日1回）
    const hour = new Date().getHours();
    if (hour === 0) {
      await runAITagging(env, 50);
    }
  },
};
```

再デプロイ：

```bash
wrangler deploy
```

## 動作確認

### バックエンドAPI

```bash
# ヘルスチェック
curl https://vtuber-db.your-subdomain.workers.dev/

# VTuber一覧取得
curl https://vtuber-db.your-subdomain.workers.dev/api/vtubers

# 統計情報取得
curl https://vtuber-db.your-subdomain.workers.dev/api/search/stats
```

### フロントエンド

ブラウザで `https://vtuber-db.pages.dev` にアクセスし、正常に表示されることを確認します。

## トラブルシューティング

### データベース接続エラー

```bash
# データベースの状態確認
wrangler d1 info vtuber-db

# データベースのクエリテスト
wrangler d1 execute vtuber-db --remote --command="SELECT COUNT(*) FROM vtubers"
```

### API認証エラー

```bash
# Secretsの確認
wrangler secret list

# Secretsの再設定
wrangler secret put YOUTUBE_API_KEY
```

### デプロイエラー

```bash
# ログの確認
wrangler tail

# 詳細ログ
wrangler tail --format=pretty
```

### フロントエンドのAPI接続エラー

フロントエンドがバックエンドAPIに接続できない場合、CORS設定を確認してください。

`src/index.js`のCORS設定：

```javascript
app.use('/*', cors({
  origin: ['https://vtuber-db.pages.dev', 'https://your-custom-domain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

## パフォーマンス最適化

### 1. KVキャッシュの活用

頻繁にアクセスされるデータをKVにキャッシュします：

```javascript
// キャッシュから取得
const cached = await env.CACHE.get('vtubers:popular', 'json');
if (cached) {
  return c.json(cached);
}

// データベースから取得してキャッシュ
const data = await fetchPopularVTubers(env.DB);
await env.CACHE.put('vtubers:popular', JSON.stringify(data), {
  expirationTtl: 3600, // 1時間
});
```

### 2. R2での画像配信

画像をR2に保存し、CDN経由で配信します：

```javascript
// 画像をR2にアップロード
await env.IMAGES.put(`avatars/${vtuberId}.jpg`, imageData, {
  httpMetadata: {
    contentType: 'image/jpeg',
  },
});

// 画像URL
const imageUrl = `https://vtuber-images.your-account.r2.dev/avatars/${vtuberId}.jpg`;
```

### 3. データベースインデックスの最適化

`schema/schema.sql`で適切なインデックスが設定されていることを確認してください。

## セキュリティ

### 1. 管理者認証の強化

本番環境では、より安全な認証方式（JWT、OAuth等）を実装することを推奨します。

### 2. レート制限

Cloudflare Workers Rate Limitingを使用してAPIへのアクセスを制限します。

### 3. APIキーの保護

Secretsは必ず`wrangler secret put`で設定し、コードに直接記述しないでください。

## モニタリング

### Cloudflare Analytics

Cloudflare Dashboardで以下を確認できます：

- リクエスト数
- エラー率
- レスポンスタイム
- 帯域幅使用量

### ログ監視

```bash
# リアルタイムログ
wrangler tail

# エラーのみ表示
wrangler tail --status=error
```

## コスト管理

### Cloudflare Workers

- 無料プラン: 100,000リクエスト/日
- 有料プラン: $5/月 + 超過分

### Cloudflare D1

- 無料プラン: 5GB storage、5M rows read/day
- 有料プラン: 使用量に応じて課金

### Cloudflare Pages

- 無料プラン: 500ビルド/月
- 有料プラン: $20/月

詳細は[Cloudflare Pricing](https://www.cloudflare.com/plans/)を参照してください。

## バックアップ

定期的にデータベースのバックアップを取得します：

```bash
# データベースのエクスポート
wrangler d1 export vtuber-db --remote --output=backup.sql
```

## 更新手順

コードを更新した場合：

```bash
# バックエンド
wrangler deploy

# フロントエンド
cd frontend
npm run build
wrangler pages deploy dist --project-name=vtuber-db
```

スキーマを更新した場合：

```bash
# マイグレーションファイルを作成
wrangler d1 execute vtuber-db --remote --file=./schema/migration_001.sql
```

## サポート

問題が発生した場合：

1. [Cloudflare Community](https://community.cloudflare.com/)で質問
2. [Cloudflare Discord](https://discord.gg/cloudflaredev)に参加
3. GitHubリポジトリでissueを作成
