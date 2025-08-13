use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, migrate::Migrator};
use std::{fs::OpenOptions, path::PathBuf};
use tauri::{AppHandle, Manager};

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub type DbPool = SqlitePool;

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
    pub download_kuake: Option<String>,
    pub download_mp3_id: Option<String>,
}

pub async fn init_db_pool(app_handle: &AppHandle) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("未能找到应用数据目录");

    std::fs::create_dir_all(&app_data_dir)?;

    let db_path: PathBuf = app_data_dir.join("musicbox.db");

    if !db_path.exists() {
        OpenOptions::new().write(true).create(true).open(&db_path)?;
    }

    let connection_string = format!("sqlite:{}", db_path.to_str().expect("数据库路径无效"));

    let pool = SqlitePool::connect(&connection_string).await?;

    MIGRATOR.run(&pool).await?;

    Ok(pool)
}

pub async fn save_music(pool: &DbPool, music_list: Vec<Music>) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let sql = r#"
        INSERT INTO music (
            song_id, title, artist, url, lyric, download_mp3, download_kuake,
            cover_url, duration_secs, download_mp3_id, play_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(song_id) DO UPDATE SET
            title = excluded.title, artist = excluded.artist, url = excluded.url,
            lyric = excluded.lyric, download_mp3 = excluded.download_mp3,
            download_kuake = excluded.download_kuake, cover_url = excluded.cover_url,
            duration_secs = excluded.duration_secs, download_mp3_id = excluded.download_mp3_id,
            play_url = excluded.play_url
    "#;

    for music in music_list {
        sqlx::query(sql)
            .bind(&music.song_id)
            .bind(&music.title)
            .bind(&music.artist)
            .bind(&music.url)
            .bind(&music.lyric)
            .bind(&music.download_mp3)
            .bind(&music.download_kuake)
            .bind(&music.cover_url)
            .bind(music.duration_secs)
            .bind(&music.download_mp3_id)
            .bind(&music.play_url)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
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
    pub download_kuake: Option<String>,
    pub download_mp3_id: Option<String>,
}

pub async fn update_music_detail(
    pool: &DbPool,
    payload: UpdateDetailPayload,
) -> Result<(), sqlx::Error> {
    let sql = r#"
        UPDATE music SET
            lyric = ?, cover_url = ?, duration_secs = ?, play_url = ?,
            download_mp3 = ?, download_kuake = ?, download_mp3_id = ?
        WHERE song_id = ?
    "#;

    sqlx::query(sql)
        .bind(&payload.lyric)
        .bind(&payload.cover_url)
        .bind(payload.duration_secs)
        .bind(&payload.play_url)
        .bind(&payload.download_mp3)
        .bind(&payload.download_kuake)
        .bind(&payload.download_mp3_id)
        .bind(&payload.song_id)
        .execute(pool)
        .await?;

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ToggleMusicPayload {
    pub playlist_id: Option<i64>,
    pub song_ids: Vec<String>,
}

pub async fn toggle_music_in_playlist(
    pool: &DbPool,
    payload: ToggleMusicPayload,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let playlist_id = match payload.playlist_id {
        Some(id) => id,
        None => {
            let first_playlist: Option<(i64,)> =
                sqlx::query_as("SELECT id FROM playlists ORDER BY created_at LIMIT 1")
                    .fetch_optional(&mut *tx)
                    .await?;

            if let Some((id,)) = first_playlist {
                id
            } else {
                sqlx::query("INSERT INTO playlists (name) VALUES ('我的歌单')")
                    .execute(&mut *tx)
                    .await?
                    .last_insert_rowid()
            }
        }
    };

    for song_id in &payload.song_ids {
        let existing: Option<(i64,)> = sqlx::query_as(
            "SELECT playlist_id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        )
        .bind(playlist_id)
        .bind(song_id)
        .fetch_optional(&mut *tx)
        .await?;

        if existing.is_some() {
            sqlx::query("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
                .bind(playlist_id)
                .bind(song_id)
                .execute(&mut *tx)
                .await?;
        } else {
            let position: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?")
                    .bind(playlist_id)
                    .fetch_one(&mut *tx)
                    .await?;

            sqlx::query(
                "INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)",
            )
            .bind(playlist_id)
            .bind(song_id)
            .bind(position.0)
            .execute(&mut *tx)
            .await?;
        }
    }

    let playlist_cover: (Option<String>,) =
        sqlx::query_as("SELECT cover_path FROM playlists WHERE id = ?")
            .bind(playlist_id)
            .fetch_one(&mut *tx)
            .await?;

    if playlist_cover.0.is_none() && !payload.song_ids.is_empty() {
        let first_song_cover: Option<(Option<String>,)> =
            sqlx::query_as("SELECT cover_url FROM songs WHERE song_id = ?")
                .bind(&payload.song_ids[0])
                .fetch_optional(&mut *tx)
                .await?;

        if let Some((Some(cover_url),)) = first_song_cover {
            sqlx::query("UPDATE playlists SET cover_path = ? WHERE id = ?")
                .bind(cover_url)
                .bind(playlist_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    tx.commit().await?;

    Ok(())
}

pub async fn create_playlist(pool: &DbPool, name: String) -> Result<i64, sqlx::Error> {
    let result = sqlx::query("INSERT INTO playlists (name) VALUES (?)")
        .bind(name)
        .execute(pool)
        .await?;

    Ok(result.last_insert_rowid())
}

pub async fn delete_playlist(pool: &DbPool, playlist_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn rename_playlist(
    pool: &DbPool,
    playlist_id: i64,
    new_name: String,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE playlists SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
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

pub async fn get_all_playlists(
    pool: &DbPool,
    song_id: Option<String>,
) -> Result<Vec<PlaylistInfo>, sqlx::Error> {
    let sql = r#"
        SELECT
            p.id,
            p.name,
            p.cover_path,
            p.created_at,
            p.updated_at,
            COUNT(ps.song_id) as song_count,
            EXISTS(SELECT 1 FROM playlist_songs WHERE playlist_id = p.id AND song_id = ?) as is_in
        FROM
            playlists p
        LEFT JOIN
            playlist_songs ps ON p.id = ps.playlist_id
        GROUP BY
            p.id
        ORDER BY
            p.created_at ASC
    "#;

    let playlists = sqlx::query_as::<_, PlaylistInfo>(sql)
        .bind(song_id) // 3. 绑定可选参数。如果 song_id 是 None，sqlx 会将其作为 NULL 绑定
        .fetch_all(pool)
        .await?;

    Ok(playlists)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaylistMusic {
    #[sqlx(flatten)]
    pub music: Music,

    pub position: i64,
    pub added_to_list_at: String,
}

///

pub async fn get_music_by_playlist_id(
    pool: &DbPool,
    playlist_id: i64,
) -> Result<Vec<PlaylistMusic>, sqlx::Error> {
    let songs = sqlx::query_as::<_, PlaylistMusic>(
        r#"
            SELECT
                s.*, -- s.* 会被 sqlx::FromRow 自动映射到拥有 #[sqlx(flatten)] 的字段
                ps.position,
                ps.added_to_list_at
            FROM
                playlist_songs ps
            INNER JOIN
                songs s ON ps.song_id = s.song_id
            WHERE
                ps.playlist_id = ?
            ORDER BY
                ps.position ASC
        "#,
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;

    Ok(songs)
}
