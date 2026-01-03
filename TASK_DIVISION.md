# VTuber-DB 改修タスク分業案

## 分業方針

### Manus（私）が担当すべきタスク
- **既存コードとの統合が必要なタスク**
- **データベースマイグレーションの実行と検証**
- **全体の進行管理とテスト**
- **デプロイと動作確認**

### Kamui-4D（Codex、Claude CLI）に任せられるタスク
- **独立した新規機能の実装**
- **既存コードを参考にした類似機能の実装**
- **フロントエンドコンポーネントの作成**
- **ジョブ処理ロジックの実装**

---

## 推奨分業プラン

### 🤖 Kamui-4Dに任せるタスク（並行実行可能）

#### タスクA: ジョブキューシステムの実装
**難易度**: 中
**独立性**: 高（既存コードへの依存が少ない）
**推定工数**: 3-4時間

**成果物**:
- `src/services/job-runner.js`
- `src/jobs/resolve-channel.js`
- `src/jobs/initial-sync-channel.js`
- `src/jobs/fetch-recent-contents.js`
- `src/jobs/ai-tagging-vtuber.js`
- `src/jobs/build-tag-relations.js`

---

#### タスクB: 新規APIエンドポイントの実装
**難易度**: 中
**独立性**: 高（既存APIパターンを踏襲）
**推定工数**: 2-3時間

**成果物**:
- `src/routes/tags-tree.js` (GET /api/tags/tree)
- `src/routes/tags-slug.js` (GET /api/tags/:slug)
- `src/routes/ingestion.js` (POST /api/ingestion-requests)

---

#### タスクC: フロントエンド新規コンポーネント
**難易度**: 中
**独立性**: 高（既存コンポーネントを参考に作成）
**推定工数**: 3-4時間

**成果物**:
- `frontend/src/components/TagTree.jsx`
- `frontend/src/components/TagRelations.jsx`
- `frontend/src/components/EvidenceDisplay.jsx`
- `frontend/src/components/SimilarVTubers.jsx`

---

#### タスクD: 管理画面の新規ページ
**難易度**: 中
**独立性**: 高（管理画面は独立したセクション）
**推定工数**: 2-3時間

**成果物**:
- `frontend/src/pages/admin/JobMonitor.jsx`
- `frontend/src/pages/admin/IngestionRequests.jsx`
- `frontend/src/pages/admin/TagEditor.jsx`

---

### 👤 Manus（私）が担当するタスク

#### タスク1: DBマイグレーション全体
**理由**: 既存データとの整合性確認が必要
**内容**:
- Phase 2: 既存テーブル拡張
- Phase 3: 新規テーブル追加
- Phase 4: データ整備とインデックス追加

---

#### タスク2: 既存APIの拡張
**理由**: 既存コードの深い理解が必要
**内容**:
- GET /api/vtubers/:id の拡張（根拠表示、似ているVTuber）
- GET /api/search の拡張（タグ階層検索、suggested_tags）

---

#### タスク3: 既存ページの改修
**理由**: 既存UIとの整合性確保が必要
**内容**:
- Home.jsx の改修（タグツリー統合）
- TagDetail.jsx の改修（関連タグ、score表示）
- Search.jsx の改修（探索支援）
- VTuberDetail.jsx の改修（根拠表示）

---

#### タスク4: 統合とテスト
**理由**: 全体の整合性確認が必要
**内容**:
- Kamuiが作成したコードの統合
- E2Eテスト実行
- パフォーマンス確認

---

#### タスク5: デプロイと動作確認
**理由**: 本番環境での検証が必要
**内容**:
- マイグレーション実行
- Workers/Pagesデプロイ
- 本番環境での動作確認

---

## Kamui-4D用の詳細指示書

以下、各タスクごとにKamui-4Dに渡す指示書を作成します。

---

## 📋 Kamui-4D タスクA: ジョブキューシステムの実装

### プロジェクト概要
VTuber Database（VTuber-DB）は、Cloudflare D1（SQLite互換）、Cloudflare Workers、Cloudflare Pagesで構築されたVTuberデータベースです。現在、53人のVTuberデータが登録されており、YouTube Data API v3とOpenAI APIを使用しています。

### 現状の問題
- 同期処理が同期的に実行されており、スケールしない
- 数万人規模になると運用が破綻する
- エラー時のリトライ機能がない

### 目標
非同期ジョブキューシステムを実装し、以下を実現する：
1. VTuber追加リクエストを受け付け、非同期で処理
2. YouTube同期、AIタグ付けを非同期で実行
3. エラー時の自動リトライ
4. ジョブの優先度管理

### データベーススキーマ（新規作成済み）

```sql
-- ジョブキュー
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    priority INTEGER DEFAULT 5,
    payload TEXT,
    not_before TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE job_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
```

### 実装するファイル

#### 1. `src/services/job-runner.js`
ジョブランナーの本体。以下の機能を実装：
- `pickNextJob()`: queued状態のジョブを優先度順で取得
- `executeJob(job)`: ジョブタイプに応じて処理を実行
- `markJobRunning(jobId)`: ジョブをrunning状態に変更
- `markJobSuccess(jobId)`: ジョブをsuccess状態に変更
- `markJobFailed(jobId, error)`: ジョブをfailed状態に変更、attemptsをインクリメント
- `createJobRun(jobId, status, error)`: job_runsに履歴を記録

#### 2. `src/jobs/resolve-channel.js`
URLからYouTube channel_idを解決するジョブ。
- 入力: `{ url: "https://www.youtube.com/@channel" }`
- 処理:
  1. URLからchannel_idを抽出（@handle形式にも対応）
  2. youtube_channelsテーブルで既存チェック
  3. 存在する場合: ingestion_requestsを`status=duplicate`に更新
  4. 存在しない場合: `initial_sync_channel`ジョブをenqueue

#### 3. `src/jobs/initial-sync-channel.js`
新規チャンネルの初回同期ジョブ。
- 入力: `{ channel_id: "UC...", ingestion_request_id: 123 }`
- 処理:
  1. YouTube Data API v3でチャンネル情報を取得（既存の`src/services/youtube.js`を活用）
  2. vtubersテーブルに新規レコード作成
  3. youtube_channelsテーブルに新規レコード作成
  4. ingestion_requestsを`status=resolved`に更新
  5. `fetch_recent_contents`ジョブをenqueue
  6. `ai_tagging_vtuber`ジョブをenqueue

#### 4. `src/jobs/fetch-recent-contents.js`
直近30本の動画情報を取得するジョブ。
- 入力: `{ vtuber_id: 1, channel_id: "UC..." }`
- 処理:
  1. YouTube Data API v3で直近30本の動画を取得
  2. youtube_contentsテーブルにUPSERT
  3. 古い動画（30本を超える分）を削除（rolling window）

#### 5. `src/jobs/ai-tagging-vtuber.js`
AIによる自動タグ付けジョブ。
- 入力: `{ vtuber_id: 1 }`
- 処理:
  1. VTuber情報を収集（名前、説明、チャンネル情報、直近動画）
  2. OpenAI APIでタグを生成（既存の`src/services/ai-tagger.js`を活用）
  3. vtuber_tagsテーブルにUPSERT（score/confidence）
  4. vtuber_tag_evidenceテーブルに根拠を保存
  5. evidence_countを更新

#### 6. `src/jobs/build-tag-relations.js`
タグの共起関係を計算するジョブ。
- 入力: `{}`（全タグを対象）
- 処理:
  1. vtuber_tagsから共起頻度を集計
  2. tag_relationsテーブルにUPSERT（relation_type=cooccur）
  3. weightを共起頻度で設定

### 既存コードの参考箇所
- `src/services/youtube.js`: YouTube API呼び出しのサンプル
- `src/services/ai-tagger.js`: OpenAI API呼び出しのサンプル
- `src/index.js`: Honoフレームワークの使い方

### 技術スタック
- Node.js
- Cloudflare Workers (Hono framework)
- Cloudflare D1 (SQLite互換)
- YouTube Data API v3
- OpenAI API

### 受け入れ条件
- [ ] 各ジョブが冪等（再実行してもデータが壊れない）
- [ ] エラー時にmax_attemptsまで自動リトライ
- [ ] job_runsに実行履歴が記録される
- [ ] 既存のYouTube/OpenAI APIコードを活用している

### 納品物
- `src/services/job-runner.js`
- `src/jobs/resolve-channel.js`
- `src/jobs/initial-sync-channel.js`
- `src/jobs/fetch-recent-contents.js`
- `src/jobs/ai-tagging-vtuber.js`
- `src/jobs/build-tag-relations.js`
- 各ファイルのテストコード（任意）

---

## 📋 Kamui-4D タスクB: 新規APIエンドポイントの実装

### プロジェクト概要
（タスクAと同じ）

### 目標
探索機能を強化するための新規APIエンドポイントを3つ実装する。

### 実装するファイル

#### 1. `src/routes/tags-tree.js`
**エンドポイント**: `GET /api/tags/tree`

**目的**: タグの親子構造を取得

**レスポンス例**:
```json
{
  "tags": [
    {
      "id": 1,
      "name": "外見",
      "slug": "appearance",
      "parent_id": null,
      "child_count": 5,
      "vtuber_count": 30,
      "children": [
        {
          "id": 2,
          "name": "可愛い系",
          "slug": "kawaii",
          "parent_id": 1,
          "child_count": 0,
          "vtuber_count": 25
        }
      ]
    }
  ]
}
```

**実装ポイント**:
- tagsテーブルからparent_idを使って階層構造を構築
- child_countは子タグの数
- vtuber_countはvtuber_tagsテーブルから集計

#### 2. `src/routes/tags-slug.js`
**エンドポイント**: `GET /api/tags/:slug`

**目的**: タグ詳細情報を取得

**レスポンス例**:
```json
{
  "tag": {
    "id": 2,
    "name": "可愛い系",
    "slug": "kawaii",
    "description": "可愛らしい外見や声のVTuber",
    "category": "appearance",
    "parent": {
      "id": 1,
      "name": "外見",
      "slug": "appearance"
    },
    "children": [],
    "related_tags": [
      {
        "id": 10,
        "name": "歌がうまい",
        "slug": "singing",
        "relation_type": "cooccur",
        "weight": 0.7
      }
    ],
    "vtubers": [
      {
        "id": 1,
        "name": "さくらみこ",
        "score": 0.95,
        "confidence": 0.9,
        "avatar_url": "..."
      }
    ]
  }
}
```

**実装ポイント**:
- slugでタグを検索
- 親タグ、子タグ、関連タグを取得
- VTuberリストはscore順でソート

#### 3. `src/routes/ingestion.js`
**エンドポイント**: `POST /api/ingestion-requests`

**目的**: VTuber追加リクエストの受付

**リクエスト例**:
```json
{
  "url": "https://www.youtube.com/@SakuraMiko"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "request_id": 123,
  "message": "リクエストを受け付けました。処理には数分かかる場合があります。"
}
```

**実装ポイント**:
- ingestion_requestsテーブルに登録
- resolve_channelジョブをenqueue（タスクAのjob-runnerを使用）
- URLバリデーション（YouTube URLかチェック）

### 既存コードの参考箇所
- `src/routes/tags.js`: 既存のタグAPIの実装
- `src/routes/vtubers.js`: 既存のVTuber APIの実装
- `src/index.js`: ルーティングの登録方法

### 受け入れ条件
- [ ] 各エンドポイントが正しいレスポンスを返す
- [ ] エラーハンドリングが適切（404/400/500）
- [ ] 既存のHonoルーティングパターンに従っている

### 納品物
- `src/routes/tags-tree.js`
- `src/routes/tags-slug.js`
- `src/routes/ingestion.js`

---

## 📋 Kamui-4D タスクC: フロントエンド新規コンポーネント

### プロジェクト概要
（タスクAと同じ）

### 目標
探索機能を強化するための新規Reactコンポーネントを4つ実装する。

### 技術スタック
- React 18
- Tailwind CSS
- React Router

### 実装するファイル

#### 1. `frontend/src/components/TagTree.jsx`
**目的**: タグの階層構造をツリー表示

**機能**:
- タグの親子関係を再帰的に表示
- クリックでタグ詳細ページに遷移
- 折りたたみ/展開機能

**デザイン**:
- Tailwind CSSでスタイリング
- インデントで階層を表現
- 各タグにVTuber数を表示

**参考**: `frontend/src/pages/TagList.jsx`

#### 2. `frontend/src/components/TagRelations.jsx`
**目的**: 関連タグを表示

**機能**:
- 関連タグのリストを表示
- relation_type（共起/兄弟/対立/橋渡し）を表示
- クリックでタグ詳細ページに遷移

**デザイン**:
- カード形式で表示
- weightに応じて強調表示

#### 3. `frontend/src/components/EvidenceDisplay.jsx`
**目的**: タグの根拠を表示

**機能**:
- vtuber_tag_evidenceから根拠を表示
- platform（YouTube/Twitter/公式サイト）ごとに分類
- snippetを表示
- 元のコンテンツへのリンク

**デザイン**:
- 引用形式で表示
- platformアイコンを表示

#### 4. `frontend/src/components/SimilarVTubers.jsx`
**目的**: 似ているVTuberを表示

**機能**:
- 共通タグの多いVTuberを表示
- アバター、名前、登録者数を表示
- クリックでVTuber詳細ページに遷移

**デザイン**:
- カード形式で横スクロール
- 共通タグ数を表示

**参考**: `frontend/src/pages/Home.jsx`の人気VTuber表示

### 既存コードの参考箇所
- `frontend/src/components/Layout.jsx`: 既存コンポーネントの構造
- `frontend/src/pages/TagList.jsx`: タグ表示の実装
- `frontend/src/pages/Home.jsx`: カード表示の実装

### 受け入れ条件
- [ ] 各コンポーネントが正しく表示される
- [ ] レスポンシブデザイン対応
- [ ] 既存のTailwind CSSスタイルに統一

### 納品物
- `frontend/src/components/TagTree.jsx`
- `frontend/src/components/TagRelations.jsx`
- `frontend/src/components/EvidenceDisplay.jsx`
- `frontend/src/components/SimilarVTubers.jsx`

---

## 📋 Kamui-4D タスクD: 管理画面の新規ページ

### プロジェクト概要
（タスクAと同じ）

### 目標
管理者がジョブ監視、取り込み申請管理、タグ編集を行えるページを3つ実装する。

### 実装するファイル

#### 1. `frontend/src/pages/admin/JobMonitor.jsx`
**目的**: ジョブの監視と管理

**機能**:
- queued/running/success/failed のジョブ一覧を表示
- failedのlast_errorを表示
- 再実行ボタン（ジョブをqueuedに戻す）
- フィルタ（job_type、status）

**API**:
- `GET /api/admin/jobs?status=failed`
- `POST /api/admin/jobs/:id/retry`

**デザイン**:
- テーブル形式で表示
- ステータスごとに色分け

#### 2. `frontend/src/pages/admin/IngestionRequests.jsx`
**目的**: VTuber追加リクエストの管理

**機能**:
- ingestion_requestsの一覧を表示
- ステータス（queued/resolved/rejected/duplicate）でフィルタ
- duplicate判定の根拠を表示
- 手動でステータス変更

**API**:
- `GET /api/admin/ingestion-requests?status=queued`
- `PUT /api/admin/ingestion-requests/:id`

**デザイン**:
- テーブル形式で表示
- URLをクリック可能に

#### 3. `frontend/src/pages/admin/TagEditor.jsx`
**目的**: タグの編集と管理

**機能**:
- tagsのCRUD
- parent_idの変更（ドラッグ&ドロップまたはセレクトボックス）
- aliasの追加/削除
- status/policyの更新
- closure再計算ジョブの実行ボタン

**API**:
- `GET /api/tags`
- `POST /api/admin/tags`
- `PUT /api/admin/tags/:id`
- `DELETE /api/admin/tags/:id`
- `POST /api/admin/tags/:id/aliases`
- `POST /api/admin/jobs/rebuild-tag-closure`

**デザイン**:
- 左: タグツリー
- 右: 編集フォーム

### 既存コードの参考箇所
- `frontend/src/pages/Admin.jsx`: 既存の管理画面
- 認証は既存のADMIN_PASSWORDを使用

### 受け入れ条件
- [ ] 各ページが正しく表示される
- [ ] CRUD操作が正しく動作する
- [ ] 認証が必要なページは保護されている

### 納品物
- `frontend/src/pages/admin/JobMonitor.jsx`
- `frontend/src/pages/admin/IngestionRequests.jsx`
- `frontend/src/pages/admin/TagEditor.jsx`

---

## 実装の進め方

### Kamui-4Dでの実行方法
1. 各タスク（A、B、C、D）を個別のプロンプトとして用意
2. Codex、Claude CLIを複数起動してコンペ形式で実装
3. 各タスクの成果物を提出
4. Manusが統合とテストを実施

### 推奨順序
1. **タスクA（ジョブキュー）**: 最優先（他のタスクの基盤）
2. **タスクB（API）**: タスクAの後（ジョブをenqueueするAPIがあるため）
3. **タスクC（コンポーネント）**: タスクBと並行可能
4. **タスクD（管理画面）**: タスクA、Bの後（ジョブ監視APIが必要）

---

## まとめ

### Kamui-4Dに任せるメリット
- **並行開発**: 複数のタスクを同時に進められる
- **コンペ形式**: 複数の実装案から最良のものを選択できる
- **独立性**: 既存コードへの影響が少ない部分を任せられる

### Manusが担当するメリット
- **統合**: 既存コードとの整合性を保てる
- **検証**: マイグレーションやデプロイの安全性を確保できる
- **全体管理**: プロジェクト全体の進行を把握できる

この分業により、効率的に改修を進められます！
