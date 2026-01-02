-- VTuber Database Schema (Simplified)
-- YouTube API + Web Scraping focused

-- VTubers テーブル
CREATE TABLE IF NOT EXISTS vtubers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    agency TEXT,
    debut_date TEXT,
    avatar_url TEXT,
    official_website TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- YouTube チャンネル情報
CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    channel_name TEXT,
    subscriber_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    custom_url TEXT,
    thumbnail_url TEXT,
    description TEXT,
    published_at TEXT,
    last_synced_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

-- Webスクレイピングデータ
CREATE TABLE IF NOT EXISTS web_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT, -- official_site, wiki, fan_site, news, etc.
    profile_data TEXT, -- JSON形式で保存
    last_scraped_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

-- タグマスター
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- appearance, content, skill, personality, etc.
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- VTuberとタグの関連
CREATE TABLE IF NOT EXISTS vtuber_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    confidence REAL DEFAULT 1.0, -- AI信頼度スコア (0.0-1.0)
    is_verified INTEGER DEFAULT 0, -- 管理者による承認フラグ
    source TEXT DEFAULT 'manual', -- manual, ai, scraping
    reason TEXT, -- タグ付けの理由
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(vtuber_id, tag_id)
);

-- 配信情報
CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    platform TEXT NOT NULL DEFAULT 'youtube',
    video_id TEXT,
    title TEXT,
    description TEXT,
    scheduled_start_time TEXT,
    actual_start_time TEXT,
    end_time TEXT,
    viewer_count INTEGER,
    stream_url TEXT,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'scheduled', -- scheduled, live, completed, cancelled
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

-- ニュース・記事
CREATE TABLE IF NOT EXISTS news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source TEXT,
    published_date TEXT,
    summary TEXT,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE SET NULL
);

-- データ更新履歴
CREATE TABLE IF NOT EXISTS update_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL, -- youtube_sync, ai_tagging, web_scraping
    status TEXT NOT NULL, -- success, failed, in_progress
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_vtubers_name ON vtubers(name);
CREATE INDEX IF NOT EXISTS idx_vtubers_agency ON vtubers(agency);
CREATE INDEX IF NOT EXISTS idx_youtube_vtuber ON youtube_channels(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_youtube_channel ON youtube_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_subscriber ON youtube_channels(subscriber_count DESC);
CREATE INDEX IF NOT EXISTS idx_web_profiles_vtuber ON web_profiles(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_web_profiles_source ON web_profiles(source_type);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_vtuber ON vtuber_tags(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_tag ON vtuber_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_verified ON vtuber_tags(is_verified);
CREATE INDEX IF NOT EXISTS idx_streams_vtuber ON streams(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_streams_platform ON streams(platform);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_scheduled ON streams(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_news_vtuber ON news_articles(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date);
CREATE INDEX IF NOT EXISTS idx_update_logs_task ON update_logs(task_type, started_at DESC);
