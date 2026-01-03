-- Migration 002: 新規テーブルの追加
-- 探索型VTuber発見エンジンへの改修
-- 作成日: 2026-01-03

-- ============================================
-- 1. tag_aliases テーブル（同義語・表記ゆれ）
-- ============================================
CREATE TABLE IF NOT EXISTS tag_aliases (
    alias TEXT PRIMARY KEY,
    tag_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_tag ON tag_aliases(tag_id);

-- ============================================
-- 2. tag_relations テーブル（関連タグ）
-- ============================================
CREATE TABLE IF NOT EXISTS tag_relations (
    tag_id INTEGER NOT NULL,
    related_tag_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL, -- cooccur/sibling/opposite/bridge
    weight REAL DEFAULT 1.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tag_id, related_tag_id, relation_type),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (related_tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_relations_tag ON tag_relations(tag_id, weight DESC);
CREATE INDEX IF NOT EXISTS idx_tag_relations_related ON tag_relations(related_tag_id);

-- ============================================
-- 3. tag_closure テーブル（階層検索高速化）
-- ============================================
CREATE TABLE IF NOT EXISTS tag_closure (
    ancestor_id INTEGER NOT NULL,
    descendant_id INTEGER NOT NULL,
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id),
    FOREIGN KEY (ancestor_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (descendant_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tag_closure_ancestor ON tag_closure(ancestor_id, depth);
CREATE INDEX IF NOT EXISTS idx_tag_closure_descendant ON tag_closure(descendant_id);

-- ============================================
-- 4. vtuber_tag_evidence テーブル（タグの根拠）
-- ============================================
CREATE TABLE IF NOT EXISTS vtuber_tag_evidence (
    vtuber_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    platform TEXT NOT NULL, -- youtube/twitter/official_site
    content_id TEXT NOT NULL, -- video_id/tweet_id/url
    evidence_type TEXT NOT NULL, -- title/description/comment/profile
    snippet TEXT, -- 短い抜粋のみ（最大500文字）
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (vtuber_id, tag_id, platform, content_id, evidence_type),
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_vtuber_tag ON vtuber_tag_evidence(vtuber_id, tag_id, weight DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_platform ON vtuber_tag_evidence(platform);

-- ============================================
-- 5. youtube_contents テーブル（直近N本の軽量コンテンツ）
-- ============================================
CREATE TABLE IF NOT EXISTS youtube_contents (
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

CREATE INDEX IF NOT EXISTS idx_youtube_contents_vtuber ON youtube_contents(vtuber_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_contents_type ON youtube_contents(content_type);
CREATE INDEX IF NOT EXISTS idx_youtube_contents_channel ON youtube_contents(channel_id);

-- ============================================
-- 6. jobs テーブル（ジョブキュー）
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL, -- resolve_channel/initial_sync/fetch_contents/ai_tagging/build_relations/rebuild_closure
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

CREATE INDEX IF NOT EXISTS idx_jobs_pick ON jobs(status, priority, not_before, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ============================================
-- 7. job_runs テーブル（ジョブ実行履歴）
-- ============================================
CREATE TABLE IF NOT EXISTS job_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- running/success/failed
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);

-- ============================================
-- 8. ingestion_requests テーブル（追加リクエスト受付）
-- ============================================
CREATE TABLE IF NOT EXISTS ingestion_requests (
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

CREATE INDEX IF NOT EXISTS idx_ingestion_status ON ingestion_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_channel ON ingestion_requests(resolved_channel_id);

-- ============================================
-- 9. news_article_vtubers テーブル（ニュース記事とVTuberの多対多）
-- ============================================
CREATE TABLE IF NOT EXISTS news_article_vtubers (
    article_id INTEGER NOT NULL,
    vtuber_id INTEGER NOT NULL,
    PRIMARY KEY (article_id, vtuber_id),
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_article_vtubers_vtuber ON news_article_vtubers(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_news_article_vtubers_article ON news_article_vtubers(article_id);

-- ============================================
-- 10. 追加のユニーク制約とインデックス
-- ============================================

-- streams テーブルにユニーク制約を追加（platform, video_id）
CREATE UNIQUE INDEX IF NOT EXISTS idx_streams_unique ON streams(platform, video_id);

-- ============================================
-- マイグレーション完了
-- ============================================
-- このマイグレーションは冪等です（再実行しても安全）
