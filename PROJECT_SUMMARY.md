# VTuber Database - プロジェクト概要

## プロジェクト概要

VTuber Databaseは、VTuberの情報を一元管理し、検索・閲覧できるWebアプリケーションです。YouTube、Twitter、Twitchから自動的にデータを収集し、OpenAI GPT-4を使用したAIによる自動タグづけ機能を備えています。

## 実装された機能

### 1. データベース設計（Cloudflare D1）

**主要テーブル**:
- `vtubers`: VTuber基本情報（名前、説明、所属、デビュー日など）
- `youtube_channels`: YouTubeチャンネル情報（登録者数、動画数など）
- `twitter_accounts`: Twitterアカウント情報（フォロワー数、ツイート数など）
- `twitch_channels`: Twitchチャンネル情報（フォロワー数、視聴回数など）
- `tags`: タグマスター（外見、配信傾向、特技、性格など）
- `vtuber_tags`: VTuberとタグの関連（AI信頼度スコア、承認フラグ付き）
- `streams`: 配信情報
- `news_articles`: ニュース・記事
- `update_logs`: データ更新履歴

**初期タグ（60種類以上）**:
- 外見属性: 髪の色（黒髪、金髪、銀髪など）、デザイン系統（可愛い系、クール系など）
- 配信傾向: 歌配信、ゲーム配信、雑談配信、ASMR配信など
- 特技: 歌がうまい、絵が上手、楽器演奏、多言語など
- 性格: 面白系、癒し系、元気系、おっとり系など

### 2. バックエンドAPI（Cloudflare Workers + Hono）

**VTuber管理API**:
- `GET /api/vtubers` - VTuber一覧取得（ページネーション、ソート対応）
- `GET /api/vtubers/:id` - VTuber詳細取得（関連データ含む）
- `POST /api/vtubers` - VTuber作成
- `PUT /api/vtubers/:id` - VTuber更新
- `DELETE /api/vtubers/:id` - VTuber削除

**検索API**:
- `GET /api/search` - 高度な検索（キーワード、タグ、所属、登録者数範囲など）
- `GET /api/search/agencies` - 所属事務所一覧
- `GET /api/search/stats` - 統計情報

**タグ管理API**:
- `GET /api/tags` - タグ一覧（カテゴリ別グループ化）
- `GET /api/tags/:id` - タグ詳細（このタグを持つVTuber一覧）
- `POST /api/tags` - タグ作成
- `PUT /api/tags/:id` - タグ更新
- `DELETE /api/tags/:id` - タグ削除
- `POST /api/tags/assign` - VTuberにタグを割り当て
- `DELETE /api/tags/assign` - VTuberからタグを削除
- `PUT /api/tags/verify` - タグの承認状態を更新

**管理者API**:
- `GET /api/admin/logs` - 更新ログ取得
- `GET /api/admin/stats` - 管理者統計
- `GET /api/admin/unverified-tags` - 未承認タグ一覧
- `POST /api/admin/sync/youtube` - YouTube同期実行
- `POST /api/admin/sync/twitter` - Twitter同期実行
- `POST /api/admin/sync/twitch` - Twitch同期実行
- `POST /api/admin/ai-tagging` - AIタグづけ実行

### 3. 外部API統合

**YouTube Data API v3**:
- チャンネル情報取得（登録者数、動画数、視聴回数）
- チャンネル検索
- 最新動画取得
- ライブ配信情報取得
- 予定配信取得
- バッチ処理対応（最大50件同時取得）

**Twitter/X API v2**:
- ユーザー情報取得（フォロワー数、ツイート数）
- ユーザー名検索
- 最新ツイート取得
- バッチ処理対応（最大100件同時取得）

**Twitch API**:
- ユーザー情報取得（フォロワー数、視聴回数）
- OAuth認証（Client Credentials Flow）
- ライブ配信情報取得
- チャンネル情報取得
- バッチ処理対応（最大100件同時取得）

### 4. AIタグづけ機能（OpenAI GPT-4.1-mini）

**自動タグ生成**:
- VTuberの情報（名前、説明、所属、ソーシャルメディア統計）を分析
- 利用可能なタグから最適なタグを5〜15個選択
- 各タグに0.0〜1.0の信頼度スコアを付与
- 選択理由も記録

**タグ再評価**:
- 既存のタグを再評価し、追加・削除すべきタグを提案
- 管理者が承認・却下を判断

**バッチ処理**:
- 複数VTuberの一括タグづけ
- レート制限対策（1秒待機）
- エラーハンドリング

### 5. データ同期Worker

**YouTube同期**:
- 登録されたYouTubeチャンネルの情報を更新
- バッチ処理で効率的に取得
- 更新ログを記録

**Twitter同期**:
- 登録されたTwitterアカウントの情報を更新
- バッチ処理で効率的に取得
- 更新ログを記録

**Twitch同期**:
- 登録されたTwitchチャンネルの情報を更新
- バッチ処理で効率的に取得
- 更新ログを記録

**定期実行（Cron Triggers）**:
- 6時間ごとにYouTube同期
- 12時間ごとにTwitter/Twitch同期
- 毎日0時にAIタグづけ（最大50件）

### 6. フロントエンド（React + Tailwind CSS）

**ホームページ**:
- 統計情報表示（総VTuber数、事務所数、総登録者数など）
- 人気VTuber一覧（登録者数順）
- 機能紹介

**検索ページ**:
- キーワード検索
- タグフィルター（カテゴリ別）
- 所属事務所フィルター
- 登録者数範囲フィルター
- ソート機能（登録者数、フォロワー数、名前、デビュー日）
- 検索結果一覧（グリッド表示）

**VTuber詳細ページ**:
- 基本情報（名前、所属、デビュー日、説明）
- ソーシャルメディア統計（YouTube、Twitter、Twitch）
- タグ一覧（カテゴリ別、承認状態表示）
- 最近の配信情報

**タグ一覧ページ**:
- カテゴリ別タグ表示
- タグ詳細へのリンク

**タグ詳細ページ**:
- タグ情報（名前、カテゴリ、説明）
- このタグを持つVTuber一覧
- 信頼度スコアと承認状態表示

**管理者画面**:
- ダッシュボード（統計情報、操作ボタン）
- 未承認タグ管理（承認・削除）
- 更新ログ表示
- データ同期実行
- AIタグづけ実行

### 7. 認証・セキュリティ

**管理者認証**:
- Bearer Token認証（簡易実装）
- 環境変数でパスワード管理
- フロントエンドはlocalStorageにトークン保存

**CORS設定**:
- すべてのオリジンを許可（本番環境では制限推奨）
- 必要なHTTPメソッドとヘッダーを許可

### 8. エラーハンドリング

**バックエンド**:
- グローバルエラーハンドラー
- 404ハンドラー
- 各APIエンドポイントでのtry-catchブロック
- エラーログ記録

**フロントエンド**:
- ローディング状態表示
- エラーメッセージ表示
- データ取得失敗時のフォールバック

## 技術スタック

### バックエンド
- **Cloudflare Workers**: サーバーレスコンピューティング
- **Cloudflare D1**: SQLiteベースのデータベース
- **Hono**: 軽量Webフレームワーク
- **Node.js 22.13.0**: ランタイム

### フロントエンド
- **React 18**: UIライブラリ
- **React Router 6**: ルーティング
- **Tailwind CSS 3**: CSSフレームワーク
- **Vite 5**: ビルドツール

### 外部サービス
- **YouTube Data API v3**: YouTubeデータ取得
- **Twitter/X API v2**: Twitterデータ取得
- **Twitch API**: Twitchデータ取得
- **OpenAI API**: AIタグづけ（GPT-4.1-mini）

### インフラ
- **Cloudflare Pages**: フロントエンドホスティング
- **Cloudflare R2**: 画像ストレージ（オプション）
- **Cloudflare KV**: キャッシュ（オプション）

## プロジェクト構成

```
VTuber-DB/
├── src/                          # バックエンドソース
│   ├── index.js                 # メインWorkerエントリーポイント
│   ├── scheduled.js             # Cronトリガーハンドラー
│   ├── routes/                  # APIルート
│   │   ├── vtubers.js          # VTuber CRUD
│   │   ├── search.js           # 検索機能
│   │   ├── tags.js             # タグ管理
│   │   ├── youtube.js          # YouTube API
│   │   ├── twitter.js          # Twitter API
│   │   ├── twitch.js           # Twitch API
│   │   ├── admin.js            # 管理者機能
│   │   └── admin-actions.js    # 管理者アクション
│   ├── services/                # 外部API統合
│   │   ├── youtube.js          # YouTube Data API
│   │   ├── twitter.js          # Twitter API
│   │   ├── twitch.js           # Twitch API
│   │   └── ai-tagger.js        # AIタグづけ
│   └── workers/                 # バックグラウンドジョブ
│       ├── sync.js             # データ同期
│       └── ai-tagging.js       # AIタグづけ実行
├── frontend/                    # フロントエンドソース
│   ├── src/
│   │   ├── main.jsx            # エントリーポイント
│   │   ├── App.jsx             # ルートコンポーネント
│   │   ├── index.css           # グローバルスタイル
│   │   ├── components/         # 共通コンポーネント
│   │   │   └── Layout.jsx     # レイアウト
│   │   └── pages/              # ページコンポーネント
│   │       ├── Home.jsx        # ホームページ
│   │       ├── Search.jsx      # 検索ページ
│   │       ├── VTuberDetail.jsx # VTuber詳細
│   │       ├── TagList.jsx     # タグ一覧
│   │       ├── TagDetail.jsx   # タグ詳細
│   │       └── Admin.jsx       # 管理者画面
│   ├── index.html              # HTMLテンプレート
│   ├── vite.config.js          # Vite設定
│   ├── tailwind.config.js      # Tailwind設定
│   ├── postcss.config.js       # PostCSS設定
│   └── package.json            # フロントエンド依存関係
├── schema/                      # データベーススキーマ
│   ├── schema.sql              # テーブル定義
│   └── seed_tags.sql           # 初期タグデータ
├── wrangler.toml               # Cloudflare Workers設定
├── package.json                # バックエンド依存関係
├── .gitignore                  # Git除外ファイル
├── .dev.vars.example           # 環境変数テンプレート
├── README.md                   # プロジェクト説明
├── DEPLOYMENT.md               # 詳細デプロイガイド
├── QUICKSTART.md               # クイックスタートガイド
└── PROJECT_SUMMARY.md          # このファイル
```

## 今後の拡張案

### 機能拡張
1. **ユーザー認証**: 一般ユーザーのログイン機能
2. **お気に入り機能**: ユーザーがVTuberをお気に入り登録
3. **コメント機能**: VTuberページへのコメント投稿
4. **通知機能**: 配信開始通知、新規VTuber追加通知
5. **ランキング機能**: 登録者数増加率ランキング
6. **比較機能**: 複数VTuberの統計比較
7. **グラフ表示**: 登録者数の推移グラフ
8. **エクスポート機能**: データのCSV/JSONエクスポート

### データ拡張
1. **配信スケジュール**: カレンダー表示
2. **コラボ情報**: コラボ配信の記録
3. **楽曲情報**: オリジナル曲、カバー曲の管理
4. **グッズ情報**: 公式グッズの情報
5. **イベント情報**: ライブ、オフラインイベント
6. **ニュース自動収集**: Webスクレイピングによるニュース収集

### AI機能拡張
1. **画像認識**: アバター画像からの属性抽出
2. **動画分析**: 配信内容の自動分析
3. **トレンド予測**: 人気上昇VTuberの予測
4. **レコメンド機能**: ユーザーの好みに基づくVTuber推薦
5. **自動要約**: VTuber紹介文の自動生成

### パフォーマンス最適化
1. **KVキャッシュ**: 頻繁にアクセスされるデータのキャッシュ
2. **R2画像配信**: 画像のCDN配信
3. **インデックス最適化**: データベースクエリの高速化
4. **ページネーション改善**: 無限スクロール対応
5. **画像遅延読み込み**: Lazy loading実装

### セキュリティ強化
1. **JWT認証**: より安全な認証方式
2. **レート制限**: API呼び出し制限
3. **CSRF対策**: トークンベース保護
4. **XSS対策**: 入力値のサニタイズ
5. **SQL injection対策**: パラメータ化クエリの徹底

## ライセンス

ISC

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

問題が発生した場合は、GitHubリポジトリでissueを作成してください。
