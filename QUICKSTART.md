# クイックスタートガイド

このガイドでは、VTuber Databaseを最速でCloudflareにデプロイする手順を説明します。

## 必要なもの

- Cloudflareアカウント（無料で作成可能）
- 以下のAPIキー：
  - YouTube Data API v3キー
  - Twitter/X API Bearer Token
  - Twitch Client IDとClient Secret
  - OpenAI APIキー

## APIキーの取得方法

### YouTube Data API v3

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. 「APIとサービス」→「ライブラリ」から「YouTube Data API v3」を有効化
4. 「認証情報」→「認証情報を作成」→「APIキー」を選択
5. 生成されたAPIキーをコピー

### Twitter/X API

1. [Twitter Developer Portal](https://developer.twitter.com/)にアクセス
2. アプリケーションを作成
3. 「Keys and tokens」タブから「Bearer Token」を生成
4. Bearer Tokenをコピー

### Twitch API

1. [Twitch Developer Console](https://dev.twitch.tv/console)にアクセス
2. アプリケーションを登録
3. Client IDとClient Secretをコピー

### OpenAI API

1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. APIキーを作成
3. APIキーをコピー

## デプロイ手順

### 1. Wrangler CLIのインストール

```bash
npm install -g wrangler
```

### 2. Cloudflareにログイン

```bash
wrangler login
```

### 3. リポジトリのクローン

```bash
git clone https://github.com/yuya-fujita-1201/VTuber-DB.git
cd VTuber-DB
```

### 4. 依存関係のインストール

```bash
npm install
cd frontend
npm install
cd ..
```

### 5. D1データベースの作成

```bash
wrangler d1 create vtuber-db
```

出力されたデータベースIDをコピーし、`wrangler.toml`の`database_id`を更新：

```toml
[[d1_databases]]
binding = "DB"
database_name = "vtuber-db"
database_id = "ここにIDを貼り付け"
```

### 6. データベーススキーマの適用

```bash
wrangler d1 execute vtuber-db --remote --file=./schema/schema.sql
wrangler d1 execute vtuber-db --remote --file=./schema/seed_tags.sql
```

### 7. 環境変数（Secrets）の設定

```bash
echo "YOUR_YOUTUBE_API_KEY" | wrangler secret put YOUTUBE_API_KEY
echo "YOUR_TWITTER_BEARER_TOKEN" | wrangler secret put TWITTER_BEARER_TOKEN
echo "YOUR_TWITCH_CLIENT_ID" | wrangler secret put TWITCH_CLIENT_ID
echo "YOUR_TWITCH_CLIENT_SECRET" | wrangler secret put TWITCH_CLIENT_SECRET
echo "YOUR_OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY
echo "YOUR_ADMIN_PASSWORD" | wrangler secret put ADMIN_PASSWORD
```

または対話的に設定：

```bash
wrangler secret put YOUTUBE_API_KEY
# プロンプトでAPIキーを入力

wrangler secret put TWITTER_BEARER_TOKEN
# プロンプトでBearer Tokenを入力

wrangler secret put TWITCH_CLIENT_ID
# プロンプトでClient IDを入力

wrangler secret put TWITCH_CLIENT_SECRET
# プロンプトでClient Secretを入力

wrangler secret put OPENAI_API_KEY
# プロンプトでAPIキーを入力

wrangler secret put ADMIN_PASSWORD
# プロンプトで管理者パスワードを入力
```

### 8. バックエンドのデプロイ

```bash
wrangler deploy
```

デプロイが成功すると、Workers URLが表示されます（例：`https://vtuber-db.your-subdomain.workers.dev`）。

### 9. フロントエンドのビルドとデプロイ

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=vtuber-db
```

デプロイが成功すると、Pages URLが表示されます（例：`https://vtuber-db.pages.dev`）。

### 10. 動作確認

ブラウザで以下にアクセス：

- **フロントエンド**: `https://vtuber-db.pages.dev`
- **バックエンドAPI**: `https://vtuber-db.your-subdomain.workers.dev`

## 初期データの投入

管理者画面からVTuberを手動で追加するか、APIを使用してデータを投入します。

### APIを使用したVTuber追加例

```bash
curl -X POST https://vtuber-db.your-subdomain.workers.dev/api/vtubers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "さくらみこ",
    "name_en": "Sakura Miko",
    "description": "ホロライブ所属のVTuber",
    "agency": "ホロライブプロダクション",
    "debut_date": "2018-08-01"
  }'
```

### YouTubeチャンネルの追加

```bash
curl -X POST https://vtuber-db.your-subdomain.workers.dev/api/youtube \
  -H "Content-Type: application/json" \
  -d '{
    "vtuber_id": 1,
    "channel_id": "UC-hM6YJuNYVAmUWxeIr9FeA",
    "channel_name": "Miko Ch. さくらみこ"
  }'
```

### データ同期の実行

管理者画面（`https://vtuber-db.pages.dev/admin`）にアクセスし、設定した管理者パスワードでログインします。

「YouTube同期」「Twitter同期」「Twitch同期」ボタンをクリックして、登録されたチャンネル情報を更新します。

### AIタグづけの実行

管理者画面で「AIタグづけ実行」ボタンをクリックすると、AIが自動的にVTuberにタグを付与します。

## トラブルシューティング

### デプロイエラー

```bash
# ログを確認
wrangler tail

# 詳細ログ
wrangler tail --format=pretty
```

### データベース接続エラー

```bash
# データベースの状態確認
wrangler d1 info vtuber-db

# テストクエリ
wrangler d1 execute vtuber-db --remote --command="SELECT COUNT(*) FROM vtubers"
```

### API認証エラー

```bash
# Secretsの確認
wrangler secret list

# Secretsの再設定
wrangler secret put YOUTUBE_API_KEY
```

## 次のステップ

1. **カスタムドメインの設定**: Cloudflare Pagesの設定からカスタムドメインを追加
2. **定期実行の設定**: `wrangler.toml`にCron設定を追加してデータの自動更新を有効化
3. **データの充実**: 管理者画面からVTuberを追加し、データベースを充実させる
4. **パフォーマンス最適化**: KVキャッシュやR2ストレージを活用

詳細は`DEPLOYMENT.md`を参照してください。

## サポート

問題が発生した場合は、GitHubリポジトリでissueを作成してください。
