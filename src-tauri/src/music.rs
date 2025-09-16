use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use sqlx::QueryBuilder;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

use crate::{
    model::{ExistingMusicDetail, Music, ToggleMusicPayload, UpdateDetailPayload},
    my_util::{DbPool, get_app_setting},
};

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
    app_handle: &AppHandle,
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
    if let Some(new_remote_url) = &payload.cover_url {
        // 检查是否需要更新：
        // 1. 数据库中没有封面
        // 2. 数据库中的封面是旧数据（远程http链接或Base64数据）
        let should_update_cover = match existing_data.cover_url.as_deref() {
            None => true,
            Some(url) => !url.starts_with("http"),
        };

        // 这自动处理了您指出的“同一专辑同一封面”的去重问题
        let filename = PathBuf::from(new_remote_url)
            .file_name()
            .and_then(|s| s.to_str())
            .map_or_else(
                || format!("{}.jpg", payload.song_id), // 如果无法解析，使用song_id作为备用
                |s| s.to_string(),
            );

        // 2. 获取本地缓存目录的完整路径
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|_| sqlx::Error::Configuration("Failed to get app data dir".into()))?;

        let local_path = app_data_dir.join("cover_cache").join(&filename);

        // 3. [关键] 仅当文件在本地不存在时才下载
        if !local_path.exists() {
            match reqwest::get(new_remote_url).await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.bytes().await {
                            Ok(bytes) => {
                                // 使用 tokio::fs 进行异步文件写入
                                if let Err(e) = tokio::fs::write(&local_path, &bytes).await {
                                    eprintln!(
                                        "Failed to write cover to cache {}: {}",
                                        local_path.display(),
                                        e
                                    );
                                } else {
                                    println!("Cover downloaded: {}", filename);
                                }
                            }
                            Err(e) => eprintln!("Failed to get cover bytes: {}", e),
                        }
                    }
                }
                Err(e) => eprintln!("Failed to download cover {}: {}", new_remote_url, e),
            }
        }
        if should_update_cover {
            // 4. 无论下载是否成功（因为它可能已存在），我们都更新数据库以存储*文件名*
            builder
                .push(separator)
                .push("cover_url = ")
                .push_bind(new_remote_url); // <-- 只存储 "1272200948.jpg" 这种小字符串
            separator = ", ";
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

pub async fn get_music_list_by_ids(
    pool: &DbPool,
    music_ids: Vec<String>,
) -> Result<Option<Vec<Music>>, String> {
    // 动态构建 SQL 查询语句中的占位符 "(?, ?, ?)"
    let placeholders = music_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!("SELECT * FROM music WHERE song_id IN ({})", placeholders);

    // 构建查询
    let mut query = sqlx::query_as::<_, Music>(&sql);
    for id in music_ids {
        query = query.bind(id);
    }

    // 执行查询并返回所有匹配的歌曲
    let music_list = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

    Ok(Some(music_list))
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

pub async fn update_music_last_play_time(pool: &DbPool, song_id: &str) -> Result<(), sqlx::Error> {
    // 1. 获取当前的 UTC 时间
    let formatted_now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

    // 3. 执行 SQL 更新，并按正确的顺序绑定参数
    sqlx::query("UPDATE music SET last_played_at = ?1 WHERE song_id = ?2")
        .bind(formatted_now) // ?1 对应第一个 .bind()
        .bind(song_id) // ?2 对应第二个 .bind()
        .execute(pool)
        .await?;

    Ok(())
}

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
            return Ok(urlencoding::encode(&file_name).to_string());
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

    let should_download_cover = match music.cover_url.as_deref() {
        None => false,
        Some(url) => url.starts_with("http"),
    };

    if should_download_cover {
        let filename = music
            .cover_url
            .as_deref()
            .and_then(|u| {
                PathBuf::from(u)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| format!("{}.jpg", music.song_id));

        let local_path = app_data_dir.join("cover_cache").join(&filename);

        // 3. [关键] 仅当文件在本地不存在时才下载
        if !local_path.exists() {
            // 仅在存在远程 URL 且为 http/data 时才尝试下载
            if let Some(remote_url) = music.cover_url.as_deref() {
                if remote_url.starts_with("http") || remote_url.starts_with("data:") {
                    match reqwest::get(remote_url).await {
                        Ok(response) => {
                            if response.status().is_success() {
                                match response.bytes().await {
                                    Ok(bytes) => {
                                        // 使用 tokio::fs 进行异步文件写入
                                        if let Err(e) = tokio::fs::write(&local_path, &bytes).await
                                        {
                                            eprintln!(
                                                "Failed to write cover to cache {}: {}",
                                                local_path.display(),
                                                e
                                            );
                                        } else {
                                            println!("Cover downloaded: {}", filename);
                                        }
                                    }
                                    Err(e) => eprintln!("Failed to get cover bytes: {}", e),
                                }
                            }
                        }
                        Err(e) => eprintln!("Failed to download cover {}: {}", remote_url, e),
                    }
                }
            }
        }
    }

    // 5. 再次检查文件是否已在磁盘上存在 (防止数据库与文件系统不同步)
    if local_path.exists() {
        println!("缓存命中 (来自磁盘检查): {:?}", &local_path);
        update_music_cache_path(&pool, &music.song_id, &local_path_str)
            .await
            .map_err(|e| format!("(同步)更新数据库失败: {}", e))?;
        return Ok(urlencoding::encode(&file_name).to_string());
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
    return Ok(urlencoding::encode(&file_name).to_string());
}

pub async fn export_music_file(
    _app_handle: AppHandle,
    pool: &DbPool,
    music_ids: Vec<String>,
) -> Result<String, String> {
    if music_ids.is_empty() {
        return Err("没有选择任何歌曲".to_string());
    }
    let total = music_ids.len();
    let music_list = get_music_list_by_ids(pool, music_ids.clone())
        .await?
        .ok_or("未找到任何歌曲".to_string())?;

    // 1. 获取下载子路径，提供默认值 "MusicBox"
    let sub_path = get_app_setting(pool, "download_path".to_string())
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "MusicBox".to_string());

    // 2. 获取文件名格式，提供默认值 "title_artist"
    let name_format = get_app_setting(pool, "filename_format".to_string())
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "title_artist".to_string());

    // 3. 获取是否移除空格的设置，默认为 "false"
    let remove_spaces = get_app_setting(pool, "filename_remove_spaces".to_string())
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    // 在安卓平台上，我们硬编码到公共的 Download 目录
    #[cfg(target_os = "android")]
    use std::path::PathBuf;

    #[cfg(target_os = "android")]
    let base_path = PathBuf::from("/storage/emulated/0/Download");

    #[cfg(not(target_os = "android"))]
    let base_path = _app_handle
        .path()
        .download_dir()
        .or_else(|_| Err("无法获取系统的下载目录".to_string()))?;

    // 2. 将基础目录与从数据库读取的子目录名拼接
    //    同时进行安全净化，防止 ".." 等路径遍历字符
    let download_path = base_path.join(sub_path.replace("..", ""));

    // 3. 确保最终的目录存在，如果不存在则创建
    if !download_path.exists() {
        tokio::fs::create_dir_all(&download_path)
            .await
            .map_err(|e| format!("创建下载目录 '{}' 失败: {}", download_path.display(), e))?;
    }

    // --- 后续逻辑的微小调整 ---

    let mut success_count = 0;
    let mut fail_count = 0;
    let mut skipped_count = 0;

    for music in music_list {
        if let Some(source_path) = music.file_path.filter(|p| !p.is_empty()) {
            let sanitized_title = music
                .title
                .replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "");
            let sanitized_artist = music
                .artist
                .replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "");

            let mut base_filename = match name_format.as_str() {
                "artist_title" => format!("{} - {}", sanitized_artist, sanitized_title),
                _ => format!("{} - {}", sanitized_title, sanitized_artist), // 默认 "title_artist"
            };

            if remove_spaces {
                base_filename = base_filename.replace(" ", "");
            }
            base_filename.push_str(".mp3");
            let mut final_path = download_path.join(&base_filename);
            let mut counter = 1;

            // [优化] 检查文件是否存在时，使用 tokio::fs::metadata 来避免阻塞
            while tokio::fs::metadata(&final_path).await.is_ok() {
                let new_filename = format!(
                    "{} - {} ({}).mp3",
                    sanitized_title, sanitized_artist, counter
                );
                final_path = download_path.join(new_filename);
                counter += 1;
            }
            println!("歌曲导出到 {} 。", final_path.display());

            // [优化] 使用异步文件复制 tokio::fs::copy，避免阻塞线程
            match tokio::fs::copy(&source_path, &final_path).await {
                Ok(_) => success_count += 1,
                Err(e) => {
                    println!("复制文件 {} 失败: {}", source_path, e);
                    fail_count += 1;
                }
            }
        } else {
            println!(
                "歌曲 {} ({}) 未缓存，跳过导出。",
                music.title, music.song_id
            );
            skipped_count += 1;
        }
    }

    if success_count > 0 {
        // 为安卓用户提供更明确的路径提示
        #[cfg(target_os = "android")]
        let final_message = format!(
            "导出完成！总共 {} 首，成功 {} 首，失败 {} 首，未缓存跳过 {} 首。文件已保存至手机 Download/MusicBox 文件夹。",
            total, success_count, fail_count, skipped_count
        );
        #[cfg(not(target_os = "android"))]
        let final_message = format!(
            "导出完成！总共 {} 首，成功 {} 首，失败 {} 首，未缓存跳过 {} 首。",
            total, success_count, fail_count, skipped_count
        );
        Ok(final_message)
    } else {
        Err(format!(
            "导出失败。总共 {} 首，失败 {} 首，未缓存跳过 {} 首。",
            total, fail_count, skipped_count
        ))
    }
}
