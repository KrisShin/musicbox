use std::path::Path;

use sqlx::QueryBuilder;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::{
    model::{
        ExistingMusicDetail, Music, PlaylistInfo, PlaylistMusic, ToggleMusicPayload,
        UpdateDetailPayload,
    },
    my_util::{DbPool, MEDIA_ADDR},
};

use super::my_util::img_url_to_b64;

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

pub async fn update_music_cache_path(
    pool: &DbPool,
    song_id: &str, // 使用 &str 避免不必要的内存分配
    file_path: &str,
) -> Result<(), sqlx::Error> {
    // 这里的 ?1 和 ?2 占位符顺序与 .bind() 的调用顺序一致
    sqlx::query("UPDATE music SET file_path = ?1 WHERE song_id = ?2")
        .bind(file_path)
        .bind(song_id)
        .execute(pool)
        .await?;
    Ok(())
}

// pub async fn update_music_last_play_time(pool: &DbPool, song_id: i64) -> Result<(), sqlx::Error> {
//     sqlx::query("UPDATE music SET last_palyed_at = ? WHERE song_id = ?")
//         .bind(song_id)
//         .execute(pool)
//         .await?;

//     Ok(song_id)
// }

pub async fn cache_music_and_get_file_path(
    app_handle: AppHandle,
    pool: &DbPool,
    music: Music,
) -> Result<String, String> {
    // 4. 使用 play_id (如果存在) 或 song_id 作为唯一文件名，避免冲突
    let sanitized_title = music
        .title
        .replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "");
    let sanitized_artist = music
        .artist
        .replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "");
    let file_name = format!(
        "{}_{}-{}.mp3",
        music.song_id, sanitized_title, sanitized_artist
    );

    // 1. 优先检查从前端传来的 music 对象中是否已包含有效的缓存路径
    if let Some(path_str) = music.file_path.as_deref() {
        if !path_str.is_empty() && Path::new(path_str).exists() {
            println!("缓存命中 (来自前端对象): {}", path_str);
            return Ok(format!(
                "http://{}/{}",
                MEDIA_ADDR,
                urlencoding::encode(&file_name)
            ));
        }
    }

    // 2. 获取应用数据目录 (对桌面和移动端都有效)
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .or_else(|_| Err("无法获取应用数据目录".to_string()))?;

    let cache_dir = app_data_dir.join("music_cache");

    // 3. 同步地确保缓存目录存在
    if !cache_dir.exists() {
        tokio::fs::create_dir_all(&cache_dir)
            .await
            .map_err(|e| format!("创建缓存目录失败: {}", e))?;
    }

    let local_path = cache_dir.join(&file_name);
    let local_path_str = local_path.to_string_lossy().into_owned();

    // 5. 再次检查文件是否已在磁盘上存在 (防止数据库与文件系统不同步)
    if local_path.exists() {
        println!("缓存命中 (来自磁盘检查): {:?}", &local_path);
        update_music_cache_path(&pool, &music.song_id, &local_path_str)
            .await
            .map_err(|e| format!("(同步)更新数据库失败: {}", e))?;
        return Ok(format!(
            "http://{}/{}",
            MEDIA_ADDR,
            urlencoding::encode(&file_name)
        ));
    }

    // --- 文件不存在，开始下载 ---
    // [修复] 使用 `?` 解包 play_url 的 Result
    let play_url = music
        .play_url
        .as_deref()
        .ok_or("歌曲缺少 play_url，无法下载".to_string())?;

    println!("开始缓存: {} -> {}", music.title, &local_path_str);

    // [修复] 使用 `?` 解包网络请求的 Result
    let response = reqwest::get(play_url)
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    // [修复] 现在 response 是 Response 类型，可以安全调用 .status()
    if !response.status().is_success() {
        return Err(format!("下载失败，状态码: {}", response.status()));
    }

    // [修复] 使用 `?` 解包获取 bytes 的 Result
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&local_path, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    println!("缓存完成: {}", music.title);

    // 7. 下载成功后，更新数据库记录
    update_music_cache_path(&pool, &music.song_id, &local_path_str)
        .await
        .map_err(|e| format!("(下载后)更新数据库失败: {}", e))?;

    Ok(format!(
        "http://{}/{}",
        MEDIA_ADDR,
        urlencoding::encode(&file_name)
    ))
}
