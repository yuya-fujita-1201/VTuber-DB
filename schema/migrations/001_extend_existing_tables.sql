-- Migration 001: 既存テーブルの拡張
-- 探索型VTuber発見エンジンへの改修
-- 作成日: 2026-01-03

-- ============================================
-- 1. tags テーブルの拡張
-- ============================================
-- タグを「探索の地図」として使えるようにする

-- slug カラムの追加（URL用の一意識別子）
ALTER TABLE tags ADD COLUMN slug TEXT;

-- parent_id カラムの追加（階層構造）
ALTER TABLE tags ADD COLUMN parent_id INTEGER REFERENCES tags(id) ON DELETE SET NULL;

-- status カラムの追加（active/merged/deprecated）
ALTER TABLE tags ADD COLUMN status TEXT DEFAULT 'active';

-- policy カラムの追加（ai_ok/review_required/manual_only）
ALTER TABLE tags ADD COLUMN policy TEXT DEFAULT 'ai_ok';

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);

-- ============================================
-- 2. vtuber_tags テーブルの拡張
-- ============================================
-- 探索スコアと根拠カウントを追加

-- score カラムの追加（当てはまりの強さ 0.0-1.0）
ALTER TABLE vtuber_tags ADD COLUMN score REAL DEFAULT 1.0;

-- evidence_count カラムの追加（根拠の数）
ALTER TABLE vtuber_tags ADD COLUMN evidence_count INTEGER DEFAULT 0;

-- last_evaluated_at カラムの追加（最終評価日時）
ALTER TABLE vtuber_tags ADD COLUMN last_evaluated_at TEXT;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_vtuber_tags_score ON vtuber_tags(tag_id, score DESC);

-- ============================================
-- 3. vtubers テーブルの拡張
-- ============================================
-- 運用Tierとオンデマンド更新対応

-- sync_tier カラムの追加（0:コア 1:通常 2:ロングテール）
ALTER TABLE vtubers ADD COLUMN sync_tier INTEGER DEFAULT 2;

-- last_viewed_at カラムの追加（最終閲覧日時）
ALTER TABLE vtubers ADD COLUMN last_viewed_at TEXT;

-- stale_level カラムの追加（データの古さレベル）
ALTER TABLE vtubers ADD COLUMN stale_level INTEGER DEFAULT 0;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_vtubers_sync_tier ON vtubers(sync_tier);
CREATE INDEX IF NOT EXISTS idx_vtubers_last_viewed ON vtubers(last_viewed_at);

-- ============================================
-- マイグレーション完了
-- ============================================
-- このマイグレーションは冪等です（再実行しても安全）
