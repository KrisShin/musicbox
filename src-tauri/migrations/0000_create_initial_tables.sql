-- 文件: src-tauri/migrations/YYYYMMDDHHMMSS_create_initial_tables.sql

-- ==== 1. 歌单表 (Playlists) ====
-- (此表结构不变，依然健壮)
CREATE TABLE IF NOT EXISTS playlist (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    cover_path    TEXT,
    description   TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))
);

-- ==== 2. 歌曲表 (music) - [V2 重构] ====
-- 根据您的 TypeScript 模型，完全重构为面向网络歌曲
CREATE TABLE IF NOT EXISTS music (
    song_id         TEXT PRIMARY KEY,                  -- 主键，来自您的接口，例如 '65537'
    title           TEXT NOT NULL,                     -- 歌曲标题
    artist          TEXT NOT NULL,                     -- 艺术家
    url             TEXT NOT NULL,                     -- 歌曲来源页面 URL
    
    -- musicDetail 部分 (全部可选)
    lyric           TEXT,                              -- 歌词文本
    download_mp3    TEXT,                              -- MP3 下载链接
    download_extra  TEXT,                              -- 夸克下载链接
    cover_url       TEXT,                              -- 封面图片 URL
    duration_secs   INTEGER,                           -- 时长 (秒)
    download_mp3_id TEXT,                              -- MP3 下载 ID
    play_url        TEXT,                              -- 实际播放的流媒体 URL

    -- 内部管理字段
    added_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')) -- 添加到本地库的时间
);


-- ==== 3. 歌单-歌曲关系表 (Playlist-music) - [V2 调整] ====
CREATE TABLE IF NOT EXISTS playlist_music (
    playlist_id     INTEGER NOT NULL,
    song_id         TEXT NOT NULL,  -- [调整] 改为 TEXT 类型以匹配 music.song_id
    position        INTEGER NOT NULL,
    added_to_list_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')),

    PRIMARY KEY (playlist_id, song_id),

    FOREIGN KEY (playlist_id) REFERENCES playlist (id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES music (song_id) ON DELETE CASCADE
);


-- ==== 4. 全局配置表 (App Settings) - [V2 新增] ====
-- 采用灵活的键值对结构存储所有全局配置
CREATE TABLE IF NOT EXISTS app_setting (
    key             TEXT PRIMARY KEY NOT NULL, -- 配置项的唯一键，例如 'play_mode'
    value           TEXT                       -- 配置项的值，统一存为文本
);


-- ==== 5. 索引与触发器 (不变) ====
CREATE INDEX IF NOT EXISTS idx_music_title ON music(title);
CREATE INDEX IF NOT EXISTS idx_music_artist ON music(artist);
CREATE TRIGGER IF NOT EXISTS trg_playlists_update_updated_at
AFTER UPDATE ON playlist
FOR EACH ROW
BEGIN
    UPDATE playlist SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') WHERE id = OLD.id;
END;