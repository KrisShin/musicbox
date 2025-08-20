use sqlx::{QueryBuilder, SqlitePool, migrate::Migrator};
use std::{fs::OpenOptions, path::PathBuf};
use tauri::{AppHandle, Manager};

use crate::model::{
    ExistingMusicDetail, Music, PlaylistInfo, PlaylistMusic, ToggleMusicPayload,
    UpdateDetailPayload,
};

use super::my_util::img_url_to_b64;

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub type DbPool = SqlitePool;

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

    let playlist_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM playlist")
        .fetch_one(&pool)
        .await?;

    // 如果没有任何歌单，就创建一个默认的
    if playlist_count.0 == 0 {
        sqlx::query("INSERT INTO playlist (name) VALUES ('我的歌单')")
            .execute(&pool)
            .await?;
    }

    Ok(pool)
}

pub async fn save_music(pool: &DbPool, music_list: Vec<Music>) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let sql = r#"
        INSERT INTO music (
            song_id, title, artist, url, lyric, download_mp3, download_extra,
            cover_url, duration_secs, download_mp3_id, play_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(song_id) DO UPDATE SET
            title = excluded.title, artist = excluded.artist, url = excluded.url,
            lyric = excluded.lyric, download_mp3 = excluded.download_mp3,
            download_extra = excluded.download_extra, cover_url = excluded.cover_url,
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
            .bind(&music.download_extra)
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

pub async fn update_music_detail(
    pool: &DbPool,
    payload: UpdateDetailPayload,
) -> Result<(), sqlx::Error> {
    // 1. 先查询数据库中已有的数据
    let existing_data: Option<ExistingMusicDetail> = sqlx::query_as(
        "SELECT 
                lyric, cover_url, duration_secs, play_url, 
                download_mp3, download_extra, download_mp3_id, play_id 
            FROM music WHERE song_id = ?",
    )
    .bind(&payload.song_id)
    .fetch_optional(pool)
    .await?;

    // 如果歌曲不存在，直接返回错误或根据业务逻辑处理
    let existing_data = match existing_data {
        Some(data) => data,
        None => return Err(sqlx::Error::RowNotFound),
    };

    // 2. 使用 QueryBuilder 动态构建 UPDATE 语句
    let mut builder: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new("UPDATE music SET ");
    let mut separator = ""; // 用于处理字段间的逗号

    // 强制更新 play_url
    if let Some(play_url) = &payload.play_url {
        builder
            .push(separator)
            .push("play_url = ")
            .push_bind(play_url);
        separator = ", ";
    }

    // --- 按需更新其他字段 ---
    if payload.lyric.is_some() && existing_data.lyric.is_none() {
        builder
            .push(separator)
            .push("lyric = ")
            .push_bind(payload.lyric.as_ref());
        separator = ", ";
    }

    if payload.play_id.is_some() && existing_data.play_id.is_none() {
        builder
            .push(separator)
            .push("play_id = ")
            .push_bind(payload.play_id.as_ref());
        separator = ", ";
    }

    if payload.duration_secs.is_some() && existing_data.duration_secs.is_none() {
        builder
            .push(separator)
            .push("duration_secs = ")
            .push_bind(payload.duration_secs);
        separator = ", ";
    }
    // --- 特殊处理 cover_url ---
    if let Some(new_cover_url) = &payload.cover_url {
        // 仅当数据库中没有 cover_url 或者cover_url以http开头(旧数据)时，才进行转换和更新
        let should_update_cover = match existing_data.cover_url.as_deref() {
            None => true,
            Some(url) => url.starts_with("http"),
        };
        if should_update_cover {
            match img_url_to_b64(new_cover_url).await {
                Ok(base64_data) => {
                    builder
                        .push(separator)
                        .push("cover_url = ")
                        .push_bind(base64_data);
                    separator = ", ";
                }
                Err(e) => {
                    // 如果转换失败，打印错误日志，但不中断整个更新流程
                    eprintln!(
                        "Error converting cover_url to base64 for song {}: {}",
                        &payload.song_id, e
                    );
                }
            }
        }
    }

    // --- 更新剩余的 download 字段 (如果需要，也可以添加按需更新逻辑) ---
    if payload.download_mp3.is_some() {
        builder
            .push(separator)
            .push("download_mp3 = ")
            .push_bind(payload.download_mp3.as_ref());
        separator = ", ";
    }

    if payload.download_extra.is_some() {
        builder
            .push(separator)
            .push("download_extra = ")
            .push_bind(payload.download_extra.as_ref());
        separator = ", ";
    }
    if payload.download_mp3_id.is_some() {
        builder
            .push(separator)
            .push("download_mp3_id = ")
            .push_bind(payload.download_mp3_id.as_ref());
    }

    // 3. 如果没有任何字段需要更新，则直接返回
    if separator.is_empty() && payload.download_mp3_id.is_none() {
        return Ok(());
    }

    // 4. 完成并执行 SQL 查询
    builder
        .push(" WHERE song_id = ")
        .push_bind(&payload.song_id);
    let query = builder.build();
    query.execute(pool).await?;
    Ok(())
}

pub async fn toggle_music_in_playlist(
    pool: &DbPool,
    payload: ToggleMusicPayload,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let playlist_id = match payload.playlist_id {
        Some(id) => id,
        None => {
            // 因为 init_db_pool 保证了歌单一定存在，我们可以安全地直接获取第一个
            let (id,): (i64,) =
                sqlx::query_as("SELECT id FROM playlist ORDER BY created_at LIMIT 1")
                    .fetch_one(&mut *tx) // 使用 fetch_one，因为它保证能找到一个
                    .await?;
            id
        }
    };

    for song_id in &payload.song_ids {
        let existing: Option<(i64,)> = sqlx::query_as(
            "SELECT playlist_id FROM playlist_music WHERE playlist_id = ? AND song_id = ?",
        )
        .bind(playlist_id)
        .bind(song_id)
        .fetch_optional(&mut *tx)
        .await?;

        if existing.is_some() {
            sqlx::query("DELETE FROM playlist_music WHERE playlist_id = ? AND song_id = ?")
                .bind(playlist_id)
                .bind(song_id)
                .execute(&mut *tx)
                .await?;
        } else {
            let position: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM playlist_music WHERE playlist_id = ?")
                    .bind(playlist_id)
                    .fetch_one(&mut *tx)
                    .await?;

            sqlx::query(
                "INSERT INTO playlist_music (playlist_id, song_id, position) VALUES (?, ?, ?)",
            )
            .bind(playlist_id)
            .bind(song_id)
            .bind(position.0)
            .execute(&mut *tx)
            .await?;
        }
    }

    let playlist_cover: (Option<String>,) =
        sqlx::query_as("SELECT cover_path FROM playlist WHERE id = ?")
            .bind(playlist_id)
            .fetch_one(&mut *tx)
            .await?;

    if playlist_cover.0.is_none() && !payload.song_ids.is_empty() {
        let first_song_cover: Option<(Option<String>,)> =
            sqlx::query_as("SELECT cover_url FROM music WHERE song_id = ?")
                .bind(&payload.song_ids[0])
                .fetch_optional(&mut *tx)
                .await?;

        if let Some((Some(cover_url),)) = first_song_cover {
            sqlx::query("UPDATE playlist SET cover_path = ? WHERE id = ?")
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
    let result = sqlx::query("INSERT INTO playlist (name) VALUES (?)")
        .bind(name)
        .execute(pool)
        .await?;

    Ok(result.last_insert_rowid())
}

pub async fn delete_playlist(pool: &DbPool, playlist_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM playlist WHERE id = ?")
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
    sqlx::query("UPDATE playlist SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(playlist_id)
        .execute(pool)
        .await?;

    Ok(())
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
            EXISTS(SELECT 1 FROM playlist_music WHERE playlist_id = p.id AND song_id = ?) as is_in
        FROM
            playlist p
        LEFT JOIN
            playlist_music ps ON p.id = ps.playlist_id
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

pub async fn get_music_by_playlist_id(
    pool: &DbPool,
    playlist_id: i64,
) -> Result<Vec<PlaylistMusic>, sqlx::Error> {
    let music_list = sqlx::query_as::<_, PlaylistMusic>(
        r#"
            SELECT
                s.*, -- s.* 会被 sqlx::FromRow 自动映射到拥有 #[sqlx(flatten)] 的字段
                ps.position,
                ps.added_to_list_at
            FROM
                playlist_music ps
            INNER JOIN
                music s ON ps.song_id = s.song_id
            WHERE
                ps.playlist_id = ?
            ORDER BY
                ps.position ASC
        "#,
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;

    Ok(music_list)
}

pub async fn save_app_setting(
    pool: &DbPool,
    key: String,
    value: String,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            INSERT INTO app_setting (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value
        "#,
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

/// 通用函数：根据 key 获取一个设置项的值
pub async fn get_app_setting(pool: &DbPool, key: String) -> Result<Option<String>, sqlx::Error> {
    let result = sqlx::query_as::<_, (String,)>("SELECT value FROM app_setting WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    // .map 将 Option<(String,)> 转换为 Option<String>
    Ok(result.map(|(value,)| value))
}

pub async fn get_music_detail_by_id(
    pool: &DbPool,
    song_id: String,
) -> Result<Option<Music>, String> {
    let music_detail = sqlx::query_as::<_, Music>("SELECT * FROM music WHERE song_id = ?")
        .bind(song_id)
        .fetch_optional(pool) // 使用 .0 来访问内部的 pool
        .await
        .map_err(|e| e.to_string())?;

    Ok(music_detail)
}
