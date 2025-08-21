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

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaylistMusic {
    #[sqlx(flatten)]
    pub music: Music,

    pub position: i64,
    pub added_to_list_at: String,
}
