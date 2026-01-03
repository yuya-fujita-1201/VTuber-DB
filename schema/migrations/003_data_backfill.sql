-- Migration 003: データ整備とバックフィル
-- 探索型VTuber発見エンジンへの改修
-- 作成日: 2026-01-03

-- ============================================
-- 1. tags.slug のバックフィル
-- ============================================
-- 既存のtags.nameからslugを生成
-- 日本語 → ローマ字変換は手動で行う必要があるため、
-- ここでは一時的にIDベースのslugを生成

UPDATE tags 
SET slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name, 
    ' ', '-'),
    '　', '-'),
    '系', ''),
    '配信', ''),
    'い', 'i'))
WHERE slug IS NULL;

-- 重複がある場合はIDを付与
UPDATE tags 
SET slug = slug || '-' || id
WHERE id IN (
    SELECT t1.id 
    FROM tags t1
    JOIN tags t2 ON t1.slug = t2.slug AND t1.id > t2.id
);

-- ============================================
-- 2. vtuber_tags.score の初期化
-- ============================================
-- 既存のconfidenceをscoreにコピー
UPDATE vtuber_tags 
SET score = confidence
WHERE score = 1.0 AND confidence IS NOT NULL AND confidence != 1.0;

-- evidence_countは0で初期化（既にデフォルト値で設定済み）

-- ============================================
-- 3. vtubers.sync_tier の初期設定
-- ============================================
-- 登録者数に応じてTierを設定
-- Tier 0（コア）: 100万人以上
-- Tier 1（通常）: 10万人以上
-- Tier 2（ロングテール）: 10万人未満

UPDATE vtubers 
SET sync_tier = CASE
    WHEN (
        SELECT subscriber_count 
        FROM youtube_channels 
        WHERE youtube_channels.vtuber_id = vtubers.id 
        LIMIT 1
    ) >= 1000000 THEN 0
    WHEN (
        SELECT subscriber_count 
        FROM youtube_channels 
        WHERE youtube_channels.vtuber_id = vtubers.id 
        LIMIT 1
    ) >= 100000 THEN 1
    ELSE 2
END;

-- ============================================
-- 4. 初期タグエイリアスの登録
-- ============================================
-- よく使われる表記ゆれを登録

-- 可愛い系
INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'かわいい', id FROM tags WHERE name = '可愛い系' LIMIT 1;

INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'kawaii', id FROM tags WHERE name = '可愛い系' LIMIT 1;

-- クール系
INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'かっこいい', id FROM tags WHERE name = 'クール系' LIMIT 1;

INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'cool', id FROM tags WHERE name = 'クール系' LIMIT 1;

-- ゲーム配信
INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'ゲーム実況', id FROM tags WHERE name = 'ゲーム配信' LIMIT 1;

INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'gaming', id FROM tags WHERE name = 'ゲーム配信' LIMIT 1;

-- 歌配信
INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT '歌枠', id FROM tags WHERE name = '歌配信' LIMIT 1;

INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'singing', id FROM tags WHERE name = '歌配信' LIMIT 1;

-- 雑談配信
INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'zatsudan', id FROM tags WHERE name = '雑談配信' LIMIT 1;

INSERT OR IGNORE INTO tag_aliases (alias, tag_id)
SELECT 'chatting', id FROM tags WHERE name = '雑談配信' LIMIT 1;

-- ============================================
-- 5. tag_closure の初期計算
-- ============================================
-- 自己参照（depth=0）
INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth)
SELECT id, id, 0 FROM tags;

-- 直接の親子関係（depth=1）
INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth)
SELECT parent_id, id, 1 
FROM tags 
WHERE parent_id IS NOT NULL;

-- 間接的な親子関係（depth=2以上）は再帰的に計算
-- SQLiteの再帰CTEを使用
INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth)
WITH RECURSIVE tag_tree AS (
    -- ベースケース: 直接の親子関係
    SELECT parent_id AS ancestor_id, id AS descendant_id, 1 AS depth
    FROM tags
    WHERE parent_id IS NOT NULL
    
    UNION ALL
    
    -- 再帰ケース: 祖先を辿る
    SELECT tt.ancestor_id, t.id AS descendant_id, tt.depth + 1
    FROM tag_tree tt
    JOIN tags t ON t.parent_id = tt.descendant_id
    WHERE tt.depth < 10 -- 最大10階層まで
)
SELECT ancestor_id, descendant_id, depth
FROM tag_tree
WHERE depth > 1;

-- ============================================
-- マイグレーション完了
-- ============================================
-- このマイグレーションは冪等です（再実行しても安全）
