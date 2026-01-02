-- 外見属性タグ
INSERT OR IGNORE INTO tags (name, category, description) VALUES
('黒髪', 'appearance', '黒髪のキャラクターデザイン'),
('金髪', 'appearance', '金髪のキャラクターデザイン'),
('銀髪', 'appearance', '銀髪のキャラクターデザイン'),
('ピンク髪', 'appearance', 'ピンク色の髪のキャラクターデザイン'),
('青髪', 'appearance', '青色の髪のキャラクターデザイン'),
('赤髪', 'appearance', '赤色の髪のキャラクターデザイン'),
('緑髪', 'appearance', '緑色の髪のキャラクターデザイン'),
('紫髪', 'appearance', '紫色の髪のキャラクターデザイン'),
('茶髪', 'appearance', '茶色の髪のキャラクターデザイン'),
('白髪', 'appearance', '白色の髪のキャラクターデザイン'),
('可愛い系', 'appearance', '可愛らしいキャラクターデザイン'),
('クール系', 'appearance', 'クールなキャラクターデザイン'),
('セクシー系', 'appearance', 'セクシーなキャラクターデザイン'),
('幼い系', 'appearance', '幼いキャラクターデザイン'),
('大人系', 'appearance', '大人っぽいキャラクターデザイン'),
('獣耳', 'appearance', '獣耳のあるキャラクターデザイン'),
('角', 'appearance', '角のあるキャラクターデザイン'),
('翼', 'appearance', '翼のあるキャラクターデザイン');

-- 配信傾向タグ
INSERT OR IGNORE INTO tags (name, category, description) VALUES
('歌配信', 'content', '歌配信を主に行う'),
('ゲーム配信', 'content', 'ゲーム配信を主に行う'),
('雑談配信', 'content', '雑談配信を主に行う'),
('ASMR配信', 'content', 'ASMR配信を主に行う'),
('お絵描き配信', 'content', 'お絵描き配信を主に行う'),
('料理配信', 'content', '料理配信を主に行う'),
('企画配信', 'content', '企画配信を主に行う'),
('コラボ配信', 'content', 'コラボ配信を主に行う'),
('ショート動画', 'content', 'ショート動画を主に投稿する'),
('FPS', 'content', 'FPSゲームを主にプレイ'),
('RPG', 'content', 'RPGゲームを主にプレイ'),
('ホラーゲーム', 'content', 'ホラーゲームを主にプレイ'),
('レトロゲーム', 'content', 'レトロゲームを主にプレイ');

-- 特技・特徴タグ
INSERT OR IGNORE INTO tags (name, category, description) VALUES
('歌がうまい', 'skill', '歌唱力が高い'),
('絵が上手', 'skill', '絵が上手'),
('楽器演奏', 'skill', '楽器を演奏できる'),
('ダンス', 'skill', 'ダンスが得意'),
('声真似', 'skill', '声真似が得意'),
('英語', 'skill', '英語が話せる'),
('中国語', 'skill', '中国語が話せる'),
('韓国語', 'skill', '韓国語が話せる'),
('多言語', 'skill', '複数の言語が話せる'),
('ゲームスキル高', 'skill', 'ゲームスキルが高い'),
('料理上手', 'skill', '料理が上手'),
('プログラミング', 'skill', 'プログラミングができる');

-- 性格・雰囲気タグ
INSERT OR IGNORE INTO tags (name, category, description) VALUES
('面白系', 'personality', '面白い配信スタイル'),
('癒し系', 'personality', '癒される配信スタイル'),
('元気系', 'personality', '元気な配信スタイル'),
('おっとり系', 'personality', 'おっとりした配信スタイル'),
('ツンデレ', 'personality', 'ツンデレキャラクター'),
('天然', 'personality', '天然キャラクター'),
('毒舌', 'personality', '毒舌キャラクター'),
('お姉さん系', 'personality', 'お姉さんキャラクター'),
('妹系', 'personality', '妹キャラクター'),
('ボーイッシュ', 'personality', 'ボーイッシュなキャラクター');

-- その他タグ
INSERT OR IGNORE INTO tags (name, category, description) VALUES
('個人勢', 'affiliation', '個人VTuber'),
('企業勢', 'affiliation', '企業所属VTuber'),
('新人', 'status', 'デビュー1年未満'),
('ベテラン', 'status', 'デビュー3年以上'),
('バイリンガル', 'special', '2言語以上話せる'),
('3Dモデル', 'technical', '3Dモデルを使用'),
('Live2D', 'technical', 'Live2Dモデルを使用');
