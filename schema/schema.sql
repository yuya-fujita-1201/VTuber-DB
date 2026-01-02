-- VTubers テーブル
CREATE TABLE IF NOT EXISTS vtubers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    agency TEXT,
    debut_date TEXT,
    avatar_url TEXT,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

-- Twitter/X アカウント情報
CREATE TABLE IF NOT EXISTS twitter_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tweet_count INTEGER DEFAULT 0,
    profile_image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);

-- Twitch チャンネル情報
CREATE TABLE IF NOT EXISTS twitch_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    channel_name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    follower_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    profile_image_url TEXT,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(vtuber_id, tag_id)
);

-- 配信情報
CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vtuber_id INTEGER NOT NULL,
    platform TEXT NOT NULL, -- youtube, twitch
    title TEXT,
    description TEXT,
    scheduled_start_time TEXT,
    actual_start_time TEXT,
    end_time TEXT,
    viewer_count INTEGER,
    stream_url TEXT,
    thumbnail_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE SET NULL
);

-- データ更新履歴
CREATE TABLE IF NOT EXISTS update_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL, -- youtube_sync, twitter_sync, twitch_sync, ai_tagging, scraping
    status TEXT NOT NULL, -- success, failed, in_progress
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_vtubers_name ON vtubers(name);
CREATE INDEX IF NOT EXISTS idx_vtubers_agency ON vtubers(agency);
CREATE INDEX IF NOT EXISTS idx_youtube_subscriber ON youtube_channels(subscriber_count DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_follower ON twitter_accounts(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_twitch_follower ON twitch_channels(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_vtuber ON vtuber_tags(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_tag ON vtuber_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_streams_vtuber ON streams(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_streams_scheduled ON streams(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_news_vtuber ON news_articles(vtuber_id);
CREATE INDEX IF NOT EXISTS idx_update_logs_task ON update_logs(task_type, started_at DESC);
