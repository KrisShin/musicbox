use std::path::Path;

use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

use crate::{
    model::{CacheAnalysisResult, PlaylistCacheInfo},
    my_util::{DbPool, format_size},
};

pub fn get_cache_size(app_handle: AppHandle) -> Result<String, String> {
    // 1. 获取应用数据目录并构建缓存目录的完整路径
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {:?}", e))?;

    let cache_dir = app_data_dir.join("music_cache");

    // 2. 检查缓存目录是否存在，如果不存在，大小为 0
    if !cache_dir.is_dir() {
        return Ok("0 B".to_string());
    }

    // 3. 使用 `walkdir` 遍历目录下的所有文件
    //    `into_iter()` 创建一个迭代器
    //    `filter_map(Result::ok)` 忽略遍历过程中可能出现的错误
    //    `filter(|e| e.file_type().is_file())` 只保留文件类型的条目
    //    `filter_map(|e| e.metadata().ok())` 获取文件的元数据
    //    `map(|m| m.len())` 获取每个文件的大小
    //    `sum()` 将所有文件的大小相加
    let total_size = WalkDir::new(cache_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum::<u64>();

    // 4. 格式化总大小并返回
    Ok(format_size(total_size))
}

/// 根据文件路径列表计算总大小
fn calculate_total_size(paths: Vec<String>) -> u64 {
    paths
        .into_iter()
        .filter_map(|p| std::fs::metadata(p).ok())
        .map(|m| m.len())
        .sum()
}

/// 2. 获取非播放列表的缓存信息
pub async fn get_non_playlist_cache_info(pool: &DbPool) -> Result<CacheAnalysisResult, String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"
            SELECT song_id, file_path FROM music
            WHERE file_path IS NOT NULL
            AND song_id NOT IN (SELECT DISTINCT song_id FROM playlist_music)
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let song_ids: Vec<String> = rows.iter().map(|(id, _)| id.clone()).collect();
    let file_paths: Vec<String> = rows.into_iter().map(|(_, path)| path).collect();
    let total_size = calculate_total_size(file_paths);

    Ok(CacheAnalysisResult {
        total_size_str: format_size(total_size),
        count: song_ids.len(),
        song_ids,
    })
}

/// 3. 获取超过3个月未播放的音乐缓存信息
pub async fn get_old_cache_info(pool: &DbPool) -> Result<CacheAnalysisResult, String> {
    // SQLite's datetime function is used to calculate the date 3 months ago
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"
            SELECT song_id, file_path FROM music
            WHERE file_path IS NOT NULL
            AND (last_played_at < strftime('%Y-%m-%d %H:%M:%S', 'now', '-3 months') OR last_played_at IS NULL)
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let song_ids: Vec<String> = rows.iter().map(|(id, _)| id.clone()).collect();
    let file_paths: Vec<String> = rows.into_iter().map(|(_, path)| path).collect();
    let total_size = calculate_total_size(file_paths);

    Ok(CacheAnalysisResult {
        total_size_str: format_size(total_size),
        count: song_ids.len(),
        song_ids,
    })
}

/// 6. 获取所有播放列表的缓存信息
pub async fn get_all_playlists_cache_info(pool: &DbPool) -> Result<Vec<PlaylistCacheInfo>, String> {
    // 使用 GROUP_CONCAT 来聚合一个播放列表下所有缓存文件的路径
    let mut playlists: Vec<PlaylistCacheInfo> = sqlx::query_as(
        r#"
        SELECT
            p.id,
            p.name,
            p.cover_path,
            COUNT(m.song_id) as cached_song_count
        FROM
            playlist p
        JOIN
            playlist_music pm ON p.id = pm.playlist_id
        JOIN
            music m ON pm.song_id = m.song_id
        GROUP BY
            p.id
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    // 在 Rust 中循环计算每个播放列表的总大小
    for playlist in playlists.iter_mut() {
        let file_paths: Vec<(String,)> = sqlx::query_as(
            r#"
            SELECT m.file_path FROM music m
            JOIN playlist_music pm ON m.song_id = pm.song_id
            WHERE pm.playlist_id = ? AND m.file_path IS NOT NULL
            "#,
        )
        .bind(playlist.id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        let total_size = calculate_total_size(file_paths.into_iter().map(|(p,)| p).collect());
        playlist.cached_size_str = format_size(total_size);
    }

    Ok(playlists)
}

/// [建议新增] 核心清理函数：根据 song_id 列表删除缓存
pub async fn clear_cache_by_ids(
    app_handle: &AppHandle, // [修改] 接收 AppHandle 来定位缓存目录
    pool: &DbPool,
    song_ids: Vec<String>,
) -> Result<(), String> {
    if song_ids.is_empty() {
        // --- 逻辑分支 1: 清空所有缓存 (优化后) ---
        println!("song_ids is empty, clearing all cache...");

        // 1. 定位缓存目录
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {:?}", e))?;
        let cache_dir = app_data_dir.join("music_cache");

        // 2. 如果目录存在，则直接删除整个目录
        if cache_dir.exists() {
            tokio::fs::remove_dir_all(&cache_dir)
                .await
                .map_err(|e| format!("删除缓存文件夹失败: {}", e))?;
            println!("Cache directory removed: {:?}", cache_dir);
        }

        // 3. 一次性更新数据库中所有记录
        sqlx::query("UPDATE music SET file_path = NULL WHERE file_path IS NOT NULL")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        // --- 逻辑分支 2: 清空指定ID的缓存 (保持不变) ---
        let placeholders = song_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql_select_paths = format!(
            "SELECT file_path FROM music WHERE song_id IN ({}) AND file_path IS NOT NULL",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String,)>(&sql_select_paths);
        for id in &song_ids {
            query = query.bind(id);
        }
        let file_paths: Vec<(String,)> = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

        for (path_str,) in file_paths {
            if Path::new(&path_str).exists() {
                if let Err(e) = tokio::fs::remove_file(&path_str).await {
                    eprintln!("Failed to delete cache file {}: {}", path_str, e);
                }
            }
        }

        let sql_update = format!(
            "UPDATE music SET file_path = NULL WHERE song_id IN ({})",
            placeholders
        );
        let mut query_update = sqlx::query(&sql_update);
        for id in song_ids {
            query_update = query_update.bind(id);
        }
        query_update
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
