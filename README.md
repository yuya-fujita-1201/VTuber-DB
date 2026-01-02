# VTuber Database

VTuberの情報を検索・閲覧できるデータベースシステムです。YouTube、Twitter、Twitchからデータを収集し、AIによる自動タグづけ機能を備えています。

## 主な機能

### ユーザー向け機能
- **高度な検索**: 名前、タグ、所属事務所、フォロワー数などで検索
- **VTuber詳細情報**: プロフィール、ソーシャルメディア統計、配信情報
- **タグ検索**: AIが付与した属性タグでVTuberを探索
- **統計情報**: 総VTuber数、登録者数などの統計

### 管理者機能
- **データ同期**: YouTube、Twitter、Twitchからの定期データ更新
- **AIタグづけ**: OpenAI GPT-4を使用した自動タグ生成
- **タグ管理**: AIが生成したタグの承認・削除
- **更新ログ**: データ同期とAI処理の履歴確認

### データ収集
- **YouTube Data API v3**: チャンネル情報、登録者数、動画数、配信情報
- **Twitter/X API v2**: アカウント情報、フォロワー数、ツイート数
- **Twitch API**: チャンネル情報、フォロワー数、配信情報

### AIタグづけ
- 外見属性（髪の色、キャラクターデザイン系統）
- 配信傾向（歌配信、ゲーム配信、雑談配信など）
- 特技・特徴（歌がうまい、絵が上手、語学力など）
- 性格・雰囲気（面白系、癒し系、元気系など）

## 技術スタック

### バックエンド
- **Cloudflare Workers**: サーバーレスAPI
- **Cloudflare D1**: SQLiteデータベース
- **Hono**: 軽量Webフレームワーク

### フロントエンド
- **React 18**: UIライブラリ
- **React Router**: ルーティング
- **Tailwind CSS**: スタイリング
- **Vite**: ビルドツール

### 外部API
- YouTube Data API v3
- Twitter/X API v2
- Twitch API
- OpenAI API (GPT-4.1-mini)

## プロジェクト構造

```
VTuber-DB/
├── src/                      # バックエンドソース
│   ├── index.js             # メインWorkerエントリーポイント
│   ├── routes/              # APIルート
│   │   ├── vtubers.js       # VTuber CRUD
│   │   ├── search.js        # 検索機能
│   │   ├── tags.js          # タグ管理
│   │   ├── youtube.js       # YouTube API
│   │   ├── twitter.js       # Twitter API
│   │   ├── twitch.js        # Twitch API
│   │   ├── admin.js         # 管理者機能
│   │   └── admin-actions.js # 管理者アクション
│   ├── services/            # 外部API統合
│   │   ├── youtube.js       # YouTube Data API
│   │   ├── twitter.js       # Twitter API
│   │   ├── twitch.js        # Twitch API
│   │   └── ai-tagger.js     # AIタグづけ
│   └── workers/             # バックグラウンドジョブ
│       ├── sync.js          # データ同期
│       └── ai-tagging.js    # AIタグづけ実行
├── frontend/                # フロントエンドソース
│   ├── src/
│   │   ├── main.jsx         # エントリーポイント
│   │   ├── App.jsx          # ルートコンポーネント
│   │   ├── components/      # 共通コンポーネント
│   │   └── pages/           # ページコンポーネント
│   │       ├── Home.jsx     # ホームページ
│   │       ├── Search.jsx   # 検索ページ
│   │       ├── VTuberDetail.jsx # VTuber詳細
│   │       ├── TagList.jsx  # タグ一覧
│   │       ├── TagDetail.jsx # タグ詳細
│   │       └── Admin.jsx    # 管理者画面
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── schema/                  # データベーススキーマ
│   ├── schema.sql          # テーブル定義
│   └── seed_tags.sql       # 初期タグデータ
├── wrangler.toml           # Cloudflare Workers設定
├── package.json
└── README.md
```

## セットアップ

### 1. 依存関係のインストール

```bash
# バックエンド
npm install

# フロントエンド
cd frontend
npm install
```

### 2. 環境変数の設定

`.dev.vars`ファイルを作成し、以下の環境変数を設定します：

```bash
# YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key

# Twitter/X API v2
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# 管理者パスワード
ADMIN_PASSWORD=your_admin_password
```

### 3. Cloudflare D1データベースの作成

```bash
# D1データベースを作成
wrangler d1 create vtuber-db

# データベースIDをwrangler.tomlに設定
# database_id = "取得したID"

# スキーマを適用
wrangler d1 execute vtuber-db --file=./schema/schema.sql
wrangler d1 execute vtuber-db --file=./schema/seed_tags.sql
```

### 4. ローカル開発

```bash
# バックエンド（Cloudflare Workers）
npm run dev

# フロントエンド（別ターミナル）
cd frontend
npm run dev
```

フロントエンドは `http://localhost:3000` でアクセスできます。

## デプロイ

### Cloudflare Workersへのデプロイ

```bash
# バックエンドをデプロイ
wrangler deploy

# フロントエンドをビルド
cd frontend
npm run build

# Cloudflare Pagesにデプロイ
# frontend/distディレクトリをCloudflare Pagesにアップロード
```

### Cloudflare Pages設定

1. Cloudflare Pagesで新しいプロジェクトを作成
2. GitHubリポジトリを接続
3. ビルド設定:
   - ビルドコマンド: `cd frontend && npm install && npm run build`
   - ビルド出力ディレクトリ: `frontend/dist`
4. 環境変数を設定（必要に応じて）

## API仕様

### VTuber API

- `GET /api/vtubers` - VTuber一覧取得
- `GET /api/vtubers/:id` - VTuber詳細取得
- `POST /api/vtubers` - VTuber作成（管理者）
- `PUT /api/vtubers/:id` - VTuber更新（管理者）
- `DELETE /api/vtubers/:id` - VTuber削除（管理者）

### 検索API

- `GET /api/search` - 高度な検索
- `GET /api/search/agencies` - 所属事務所一覧
- `GET /api/search/stats` - 統計情報

### タグAPI

- `GET /api/tags` - タグ一覧取得
- `GET /api/tags/:id` - タグ詳細取得
- `POST /api/tags` - タグ作成（管理者）
- `PUT /api/tags/:id` - タグ更新（管理者）
- `DELETE /api/tags/:id` - タグ削除（管理者）
- `POST /api/tags/assign` - タグ割り当て
- `DELETE /api/tags/assign` - タグ削除
- `PUT /api/tags/verify` - タグ承認

### 管理者API

- `GET /api/admin/logs` - 更新ログ取得
- `GET /api/admin/stats` - 管理者統計
- `GET /api/admin/unverified-tags` - 未承認タグ一覧
- `POST /api/admin/sync/youtube` - YouTube同期実行
- `POST /api/admin/sync/twitter` - Twitter同期実行
- `POST /api/admin/sync/twitch` - Twitch同期実行
- `POST /api/admin/ai-tagging` - AIタグづけ実行

## データベーススキーマ

### 主要テーブル

- **vtubers**: VTuber基本情報
- **youtube_channels**: YouTubeチャンネル情報
- **twitter_accounts**: Twitterアカウント情報
- **twitch_channels**: Twitchチャンネル情報
- **tags**: タグマスター
- **vtuber_tags**: VTuberとタグの関連
- **streams**: 配信情報
- **news_articles**: ニュース・記事
- **update_logs**: データ更新履歴

詳細は `schema/schema.sql` を参照してください。

## 定期実行

Cloudflare Workers Cronを使用して、以下のタスクを定期実行できます：

```toml
# wrangler.tomlに追加
[triggers]
crons = [
  "0 */6 * * *",  # 6時間ごとにYouTube同期
  "0 */12 * * *", # 12時間ごとにTwitter同期
  "0 0 * * *",    # 毎日AIタグづけ
]
```

## ライセンス

ISC

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

問題が発生した場合は、GitHubのissueを作成してください。
