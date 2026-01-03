# VTuber-DB 改修タスクリスト

## プロジェクト方針
- **コンセプト**: "名簿"から「探索型VTuber発見エンジン」へ
- **重点機能**: タグ階層・根拠表示・ジョブキュー・運用Tier
- **スケール対応**: 数万人規模でも運用破綻しない設計

---

## Phase 1: 現行コードの分析とタスクリスト作成 ✅

### 完了項目
- [x] 既存スキーマの確認
- [x] 既存ファイル構造の把握
- [x] タスクリストの作成

---

## Phase 2: DBマイグレーション実装（既存テーブル拡張）

### 2-1. tags テーブルの拡張
**目的**: タグを「探索の地図」として使えるようにする

**追加カラム**:
- `slug TEXT UNIQUE` - URL用の一意識別子
- `parent_id INTEGER` - 階層構造（親タグのID）
- `status TEXT DEFAULT 'active'` - active/merged/deprecated
- `policy TEXT DEFAULT 'ai_ok'` - ai_ok/review_required/manual_only

**インデックス**:
- `UNIQUE(slug)`
- `INDEX(parent_id)`

**受け入れ条件**:
- [ ] マイグレーションSQLファイル作成
- [ ] 既存データが壊れないことを確認
- [ ] 新規カラムが追加されていることを確認

---

### 2-2. vtuber_tags テーブルの拡張
**目的**: 探索スコアと根拠カウントを追加

**追加カラム**:
- `score REAL DEFAULT 1.0` - 当てはまりの強さ（0.0-1.0）
- `evidence_count INTEGER DEFAULT 0` - 根拠の数
- `last_evaluated_at TEXT` - 最終評価日時

**インデックス**:
- `INDEX(tag_id, score DESC)`

**受け入れ条件**:
- [ ] マイグレーションSQLファイル作成
- [ ] 既存のconfidenceとの違いを明確化（confidence=確かさ、score=強さ）
- [ ] 既存データが壊れないことを確認

---

### 2-3. vtubers テーブルの拡張
**目的**: 運用Tierとオンデマンド更新対応

**追加カラム**:
- `sync_tier INTEGER DEFAULT 2` - 0:コア 1:通常 2:ロングテール
- `last_viewed_at TEXT` - 最終閲覧日時（オンデマンド更新用）
- `stale_level INTEGER DEFAULT 0` - データの古さレベル

**受け入れ条件**:
- [ ] マイグレーションSQLファイル作成
- [ ] 既存データが壊れないことを確認
- [ ] Tier運用方針をREADMEに記載

---

## Phase 3: DBマイグレーション実装（新規テーブル追加）

### 3-1. tag_aliases テーブル
**目的**: 同義語・表記ゆれの吸収

```sql
CREATE TABLE tag_aliases (
    alias TEXT PRIMARY KEY,
    tag_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] 初期データ投入（例: "かわいい" → "可愛い系"）

---

### 3-2. tag_relations テーブル
**目的**: 関連タグ（横移動）の管理

```sql
CREATE TABLE tag_relations (
    tag_id INTEGER NOT NULL,
    related_tag_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL, -- cooccur/sibling/opposite/bridge
    weight REAL DEFAULT 1.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tag_id, related_tag_id, relation_type),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (related_tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] relation_typeの定義を明確化

---

### 3-3. tag_closure テーブル（オプション）
**目的**: 階層検索の高速化

```sql
CREATE TABLE tag_closure (
    ancestor_id INTEGER NOT NULL,
    descendant_id INTEGER NOT NULL,
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id),
    FOREIGN KEY (ancestor_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (descendant_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] 再計算ジョブの実装

---

### 3-4. vtuber_tag_evidence テーブル
**目的**: タグの根拠を保存

```sql
CREATE TABLE vtuber_tag_evidence (
    vtuber_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    platform TEXT NOT NULL, -- youtube/twitter/official_site
    content_id TEXT NOT NULL, -- video_id/tweet_id/url
    evidence_type TEXT NOT NULL, -- title/description/comment/profile
    snippet TEXT, -- 短い抜粋のみ（長文禁止）
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (vtuber_id, tag_id, platform, content_id, evidence_type),
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_vtuber_tag ON vtuber_tag_evidence(vtuber_id, tag_id);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] snippetの長さ制限を実装（最大500文字など）

---

### 3-5. youtube_contents テーブル
**目的**: 直近N本の軽量コンテンツ保持（rolling window）

```sql
CREATE TABLE youtube_contents (
    video_id TEXT PRIMARY KEY,
    vtuber_id INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- live/upcoming/upload/short
    title TEXT,
    description TEXT,
    published_at TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

CREATE INDEX idx_youtube_contents_vtuber ON youtube_contents(vtuber_id, published_at DESC);
CREATE INDEX idx_youtube_contents_type ON youtube_contents(content_type);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] rolling window実装（古いデータの自動削除）

---

### 3-6. jobs / job_runs テーブル
**目的**: ジョブキューシステム

```sql
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL, -- resolve_channel/initial_sync/fetch_contents/ai_tagging/build_relations
    status TEXT NOT NULL DEFAULT 'queued', -- queued/running/success/failed
    priority INTEGER DEFAULT 5, -- 0=highest, 10=lowest
    payload TEXT, -- JSON形式
    not_before TEXT, -- この時刻より前には実行しない
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT
);

CREATE INDEX idx_jobs_pick ON jobs(status, priority, not_before, created_at);
CREATE INDEX idx_jobs_type ON jobs(job_type);

CREATE TABLE job_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- running/success/failed
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_runs_job ON job_runs(job_id, started_at DESC);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] ジョブピック用のインデックスが効いていることを確認

---

### 3-7. ingestion_requests テーブル
**目的**: VTuber追加リクエストの受付

```sql
CREATE TABLE ingestion_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued/resolved/rejected/duplicate
    resolved_vtuber_id INTEGER,
    resolved_channel_id TEXT,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY (resolved_vtuber_id) REFERENCES vtubers(id) ON DELETE SET NULL
);

CREATE INDEX idx_ingestion_status ON ingestion_requests(status, created_at DESC);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] duplicate判定ロジックの実装

---

### 3-8. news_article_vtubers テーブル
**目的**: ニュース記事とVTuberの多対多関連

```sql
CREATE TABLE news_article_vtubers (
    article_id INTEGER NOT NULL,
    vtuber_id INTEGER NOT NULL,
    PRIMARY KEY (article_id, vtuber_id),
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

CREATE INDEX idx_news_article_vtubers_vtuber ON news_article_vtubers(vtuber_id);
```

**受け入れ条件**:
- [ ] テーブル作成
- [ ] 既存のnews_articles.vtuber_idからのマイグレーション

---

## Phase 4: データ整備とインデックス追加

### 4-1. tags.slug のバックフィル
**タスク**:
- 既存のtags.nameからslugを生成
- 重複時は連番で一意化（例: "kawaii-1", "kawaii-2"）

**受け入れ条件**:
- [ ] 全tagsにslugが設定されている
- [ ] slugが一意である

---

### 4-2. vtuber_tags.score の初期化
**タスク**:
- 既存のconfidenceをscoreにコピー
- evidence_countを0で初期化

**受け入れ条件**:
- [ ] 全vtuber_tagsにscoreが設定されている

---

### 4-3. 重要インデックスの追加
**タスク**:
- `UNIQUE(youtube_channels.channel_id)` - 既に存在
- `UNIQUE(streams.platform, video_id)` - 追加
- `UNIQUE(tags.category, name)` - 運用方針により追加検討
- `INDEX(jobs.status, priority, not_before, created_at)` - 追加済み

**受け入れ条件**:
- [ ] 必要なインデックスがすべて追加されている
- [ ] EXPLAINでインデックスが効いていることを確認

---

### 4-4. tag_closure の初期計算（導入する場合）
**タスク**:
- tags.parent_idから階層を計算
- tag_closureテーブルに投入

**受け入れ条件**:
- [ ] 全階層がclosureテーブルに反映されている

---

## Phase 5: ジョブキューシステムの実装

### 5-1. ジョブランナーの実装
**ファイル**: `src/services/job-runner.js`

**機能**:
- jobsテーブルから`status=queued`を優先度順で取得
- 実行中は`status=running`に変更
- 成功時は`status=success`、失敗時は`status=failed`
- `attempts++`、`last_error`を記録
- `job_runs`に履歴を書き込む

**受け入れ条件**:
- [ ] ジョブランナーが動作する
- [ ] 冪等性が保証されている（再実行してもデータが壊れない）
- [ ] エラー時のリトライロジックが実装されている

---

### 5-2. ジョブタイプの実装

#### 5-2-1. resolve_channel ジョブ
**目的**: ingestion_requests.requested_urlからYouTube channel_idを解決

**処理**:
1. URLからchannel_idを抽出
2. 既存のyoutube_channelsに存在するか確認
3. 存在する場合は`status=duplicate`、存在しない場合は`initial_sync_channel`ジョブをenqueue
4. `resolved_channel_id`を記録

**受け入れ条件**:
- [ ] URLパースが正しく動作する
- [ ] duplicate判定が正しい
- [ ] 次のジョブが正しくenqueueされる

---

#### 5-2-2. initial_sync_channel ジョブ
**目的**: 新規チャンネルの初回同期

**処理**:
1. YouTube Data APIでチャンネル情報を取得
2. vtubersテーブルに新規レコード作成
3. youtube_channelsテーブルに新規レコード作成
4. `fetch_recent_contents`ジョブをenqueue
5. `ai_tagging_vtuber`ジョブをenqueue

**受け入れ条件**:
- [ ] チャンネル情報が正しく取得される
- [ ] vtubersとyoutube_channelsが正しく作成される
- [ ] 次のジョブが正しくenqueueされる

---

#### 5-2-3. fetch_recent_contents ジョブ
**目的**: 直近N本（30本）の動画情報を取得

**処理**:
1. YouTube Data APIで直近30本の動画を取得
2. youtube_contentsテーブルにUPSERT
3. 古い動画（30本を超える分）を削除（rolling window）

**受け入れ条件**:
- [ ] 直近30本が正しく取得される
- [ ] rolling windowが正しく動作する
- [ ] 冪等性が保証されている

---

#### 5-2-4. ai_tagging_vtuber ジョブ
**目的**: AIによる自動タグ付け

**処理**:
1. VTuberの情報（名前、説明、チャンネル情報、直近動画）を収集
2. OpenAI APIでタグを生成
3. vtuber_tagsテーブルにUPSERT（score/confidence）
4. vtuber_tag_evidenceテーブルに根拠を保存
5. evidence_countを更新

**受け入れ条件**:
- [ ] タグが正しく生成される
- [ ] 根拠が正しく保存される
- [ ] 既存のai-tagger.jsを活用する

---

#### 5-2-5. build_tag_relations ジョブ
**目的**: タグの共起関係を計算

**処理**:
1. vtuber_tagsから共起頻度を集計
2. tag_relationsテーブルにUPSERT（relation_type=cooccur）
3. weightを共起頻度で設定

**受け入れ条件**:
- [ ] 共起関係が正しく計算される
- [ ] weightが適切に設定される

---

#### 5-2-6. rebuild_tag_closure ジョブ（導入する場合）
**目的**: タグ階層の再計算

**処理**:
1. tag_closureテーブルを全削除
2. tags.parent_idから階層を再計算
3. tag_closureテーブルに投入

**受け入れ条件**:
- [ ] 階層が正しく計算される
- [ ] 冪等性が保証されている

---

### 5-3. Tier運用の実装
**タスク**:
- vtubers.sync_tierに応じて更新頻度を変える
- Tier 0（コア）: 6時間ごと
- Tier 1（通常）: 24時間ごと
- Tier 2（ロングテール）: 閲覧時のみ更新

**受け入れ条件**:
- [ ] Tier別の更新ロジックが実装されている
- [ ] last_viewed_atが正しく更新される

---

## Phase 6: 公開API拡張（探索機能）

### 6-1. GET /api/tags/tree
**目的**: タグの親子構造を取得

**レスポンス**:
```json
{
  "tags": [
    {
      "id": 1,
      "name": "外見",
      "slug": "appearance",
      "parent_id": null,
      "child_count": 5,
      "vtuber_count": 30
    }
  ]
}
```

**受け入れ条件**:
- [ ] 親子構造が正しく返される
- [ ] child_countとvtuber_countが正しい

---

### 6-2. GET /api/tags/:slug
**目的**: タグ詳細情報を取得

**レスポンス**:
```json
{
  "tag": {
    "id": 1,
    "name": "可愛い系",
    "slug": "kawaii",
    "description": "...",
    "parent": {...},
    "children": [...],
    "related_tags": [...],
    "vtubers": [...]
  }
}
```

**受け入れ条件**:
- [ ] タグ情報が正しく返される
- [ ] 親・子・関連タグが正しく返される
- [ ] VTuberリストがscore順で返される

---

### 6-3. GET /api/vtubers/:id の拡張
**追加レスポンス**:
```json
{
  "vtuber": {...},
  "tags": [
    {
      "tag": {...},
      "score": 0.9,
      "confidence": 0.85,
      "evidence": [
        {
          "platform": "youtube",
          "content_id": "video123",
          "evidence_type": "title",
          "snippet": "かわいい歌声で..."
        }
      ]
    }
  ],
  "similar_vtubers": [...]
}
```

**受け入れ条件**:
- [ ] タグの根拠が正しく返される
- [ ] 似ているVTuberが返される（共通タグ上位など）

---

### 6-4. GET /api/search の拡張
**追加パラメータ**:
- `tag_ids[]`: タグIDの配列（階層含む）
- `sort`: score/subscriber/updated

**追加レスポンス**:
```json
{
  "vtubers": [...],
  "suggested_tags": [...], // 次に辿る候補
  "total": 100
}
```

**受け入れ条件**:
- [ ] タグ階層検索が動作する
- [ ] suggested_tagsが返される

---

### 6-5. POST /api/ingestion-requests
**目的**: VTuber追加リクエストの受付

**リクエスト**:
```json
{
  "url": "https://www.youtube.com/@channel"
}
```

**処理**:
1. ingestion_requestsテーブルに登録
2. resolve_channelジョブをenqueue

**受け入れ条件**:
- [ ] リクエストが正しく登録される
- [ ] ジョブが正しくenqueueされる

---

## Phase 7: フロントエンド改修（探索UI）

### 7-1. トップページの改修
**ファイル**: `frontend/src/pages/Home.jsx`

**追加要素**:
- タグツリー（親→子）の表示
- 選択中タグの関連タグ（横移動）
- 探索ショートカット（人気タグ、新着タグなど）

**受け入れ条件**:
- [ ] タグツリーが表示される
- [ ] 関連タグが表示される
- [ ] クリックで探索できる

---

### 7-2. タグページの改修
**ファイル**: `frontend/src/pages/TagDetail.jsx`

**追加要素**:
- 親タグ・子タグ・関連タグの表示
- VTuber一覧（score順）
- 絞り込み導線（このタグ + 追加タグ）

**受け入れ条件**:
- [ ] 親・子・関連タグが表示される
- [ ] VTuberがscore順で表示される
- [ ] 絞り込みができる

---

### 7-3. 検索結果ページの改修
**ファイル**: `frontend/src/pages/Search.jsx`

**追加要素**:
- 左: フィルタ（タグ階層、所属、登録者数レンジ）
- 右: 探索支援（関連タグ、似ているカテゴリ）

**受け入れ条件**:
- [ ] フィルタが動作する
- [ ] 探索支援が表示される

---

### 7-4. VTuber詳細ページの改修
**ファイル**: `frontend/src/pages/VTuberDetail.jsx`

**追加要素**:
- タグ（score/confidence）の表示
- 根拠セクション（動画タイトル、説明文からの抜粋）
- 似ているVTuber導線

**受け入れ条件**:
- [ ] タグと根拠が表示される
- [ ] 似ているVTuberが表示される

---

## Phase 8: 管理画面拡張（ジョブ監視・タグ編集）

### 8-1. ジョブ監視画面
**ファイル**: `frontend/src/pages/admin/JobMonitor.jsx`

**機能**:
- queued/running/failed の一覧
- failedのlast_error表示
- 再実行ボタン（enqueueし直す）

**受け入れ条件**:
- [ ] ジョブ一覧が表示される
- [ ] エラー詳細が表示される
- [ ] 再実行ができる

---

### 8-2. 取り込み申請管理画面
**ファイル**: `frontend/src/pages/admin/IngestionRequests.jsx`

**機能**:
- ingestion_requestsの一覧
- duplicate判定の根拠表示
- 手動でrejected/resolved変更

**受け入れ条件**:
- [ ] 申請一覧が表示される
- [ ] ステータス変更ができる

---

### 8-3. タグ地図エディタ
**ファイル**: `frontend/src/pages/admin/TagEditor.jsx`

**機能**:
- tagsのCRUD
- parent付け替え
- alias追加/削除
- status/policy更新
- closure再計算ジョブの実行ボタン

**受け入れ条件**:
- [ ] タグのCRUDができる
- [ ] 階層の変更ができる
- [ ] aliasの管理ができる

---

## Phase 9: E2Eテストとドキュメント作成

### 9-1. E2Eテスト
**テストシナリオ**:
1. VTuber追加リクエスト（URL貼り付け）
2. resolve_channelジョブ実行
3. initial_sync_channelジョブ実行
4. fetch_recent_contentsジョブ実行
5. ai_tagging_vtuberジョブ実行
6. フロントエンドで表示確認

**受け入れ条件**:
- [ ] 全シナリオが正常に動作する
- [ ] エラーハンドリングが適切

---

### 9-2. ドキュメント作成
**ファイル**: `README.md`、`OPERATIONS.md`

**内容**:
- ジョブ実行方法
- Tier運用方針
- rolling window方針（直近30本）
- タグ階層の管理方法
- トラブルシューティング

**受け入れ条件**:
- [ ] 運用手順が明確
- [ ] トラブルシューティングが充実

---

## Phase 10: デプロイと動作確認

### 10-1. マイグレーション実行
**タスク**:
- D1データベースにマイグレーションを適用
- データ整備スクリプトを実行

**受け入れ条件**:
- [ ] マイグレーションが成功
- [ ] データが壊れていない

---

### 10-2. Workers/Pagesデプロイ
**タスク**:
- Cloudflare Workersにデプロイ
- Cloudflare Pagesにデプロイ

**受け入れ条件**:
- [ ] デプロイが成功
- [ ] 本番環境で動作確認

---

### 10-3. パフォーマンス確認
**タスク**:
- 主要クエリのEXPLAIN確認
- インデックスが効いているか確認

**受け入れ条件**:
- [ ] クエリが高速
- [ ] インデックスが効いている

---

## Phase 11: 最終報告

### 11-1. 完成報告書の作成
**内容**:
- 実装した機能一覧
- 変更点のサマリ
- 運用方法
- 今後の拡張案

**受け入れ条件**:
- [ ] 報告書が完成
- [ ] ユーザーに提出

---

## 進捗管理

### 完了済み
- [x] Phase 1: 現行コードの分析とタスクリスト作成

### 実装中
- [ ] Phase 2: DBマイグレーション実装（既存テーブル拡張）

### 未着手
- [ ] Phase 3: DBマイグレーション実装（新規テーブル追加）
- [ ] Phase 4: データ整備とインデックス追加
- [ ] Phase 5: ジョブキューシステムの実装
- [ ] Phase 6: 公開API拡張（探索機能）
- [ ] Phase 7: フロントエンド改修（探索UI）
- [ ] Phase 8: 管理画面拡張（ジョブ監視・タグ編集）
- [ ] Phase 9: E2Eテストとドキュメント作成
- [ ] Phase 10: デプロイと動作確認
- [ ] Phase 11: 最終報告

---

## 注意事項

### 制約
- YouTubeやSNSのHTMLスクレイピング依存を増やさない
- D1の特性に合わせて、巨大な本文や巨大JSONをDBに溜めない
- 取り込み/同期は冪等（同じジョブを再実行しても壊れない）にする

### 実装方針
- 小さな単位でコミット/PR化
- 各Phaseで「動くところまで」仕上げる
- 既存機能を壊さない

---

**作成日**: 2026年1月3日
**最終更新**: 2026年1月3日
