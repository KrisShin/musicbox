use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow)]
pub struct Music {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub url: String,

    pub lyric: Option<String>,
    pub cover_url: Option<String>,
    #[serde(rename = "duration")]
    pub duration_secs: Option<f64>,
    pub play_url: Option<String>,
    pub download_mp3: Option<String>,
    pub download_extra: Option<String>,
    pub download_mp3_id: Option<String>,
    pub play_id: Option<String>,
    pub file_path: Option<String>,
    pub last_played_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDetailPayload {
    pub song_id: String,
    pub lyric: Option<String>,
    pub cover_url: Option<String>,
    #[serde(rename = "duration")]
    pub duration_secs: Option<f64>,
    pub play_url: Option<String>,
    pub download_mp3: Option<String>,
    pub download_extra: Option<String>,
    pub download_mp3_id: Option<String>,
    pub play_id: Option<String>,
}

#[derive(sqlx::FromRow, Debug)]
pub struct ExistingMusicDetail {
    pub lyric: Option<String>,
    pub cover_url: Option<String>,
    pub duration_secs: Option<f64>,
    pub play_url: Option<String>,
    pub download_mp3: Option<String>,
    pub download_extra: Option<String>,
    pub download_mp3_id: Option<String>,
    pub play_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleMusicPayload {
    pub playlist_id: Option<i64>,
    pub song_ids: Vec<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaylistInfo {
    pub id: i64,
    pub name: String,
    pub cover_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[sqlx(rename = "song_count")]
    pub song_count: i64,

    pub is_in: bool,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct PlaylistMusicItem {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub cover_url: Option<String>,
    pub file_path: Option<String>,
}

// [新增] 为缓存分析接口定义返回的数据结构
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CacheAnalysisResult {
    pub total_size_str: String,
    pub song_ids: Vec<String>,
    pub count: usize,
}

// [新增] 为播放列表缓存信息定义返回的数据结构
#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct PlaylistCacheInfo {
    pub id: i64,
    pub name: String,
    pub cover_path: Option<String>,
    pub song_count: i64,
    
    // 这个字段仍然在 Rust 中计算，保持不变
    #[sqlx(skip)] 
    #[serde(default)] 
    pub cached_size_str: String,
    
    pub cached_song_count: i64, 
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct CachedMusicInfo {
    // 从 music 表中直接获取的字段
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub cover_url: Option<String>,
    pub file_path: String, // file_path 在这里必须存在
    pub last_played_at: Option<String>,

    // 在 Rust 中动态计算的字段
    #[sqlx(skip)] // 告诉 sqlx 不要尝试从数据库映射这个字段
    #[serde(default)]
    pub file_size_bytes: u64,
}

#[derive(sqlx::FromRow)]
pub struct MusicToDelete {
    pub song_id: String,
    pub file_path: String,
}
