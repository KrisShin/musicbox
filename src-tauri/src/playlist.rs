use std::path::PathBuf;

use chrono::{SecondsFormat, Utc};
use tauri::AppHandle;
#[cfg(not(target_os = "android"))]
use tauri::Manager;

use crate::{
    model::{PlaylistInfo, PlaylistMusicItem},
    my_util::{DbPool, get_app_setting},
};

pub async fn create_playlist(pool: &DbPool) -> Result<i64, sqlx::Error> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM playlist")
        .fetch_one(pool)
        .await?;

    let new_name = format!("我的歌单{}", count + 1);

    let result = sqlx::query("INSERT INTO playlist (name) VALUES (?)")
        .bind(new_name)
        .execute(pool)
        .await?;

    Ok(result.last_insert_rowid())
}

pub async fn delete_playlist(pool: &DbPool, playlist_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM playlist_music WHERE playlist_id = ?")
        .bind(playlist_id)
        .execute(pool)
        .await?;
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
) -> Result<Vec<PlaylistMusicItem>, sqlx::Error> {
    let music_list = sqlx::query_as::<_, PlaylistMusicItem>(
        r#"
            SELECT
                m.song_id,
                m.title,
                m.artist,
                m.cover_url,
                m.file_path
            FROM
                playlist_music pm
            INNER JOIN
                music m ON pm.song_id = m.song_id
            WHERE
                pm.playlist_id = ?
            ORDER BY
                pm.position DESC
        "#,
    )
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;

    Ok(music_list)
}

/// [新增] 更新一个歌单的封面图片路径
pub async fn update_playlist_cover(
    pool: &DbPool,
    playlist_id: i64,
    cover_path: String,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE playlist SET cover_path = ? WHERE id = ?")
        .bind(cover_path)
        .bind(playlist_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn export_db_file(_app_handle: AppHandle, pool: &DbPool) -> Result<String, String> {
    // 1. 获取下载子路径，提供默认值 "MusicBox"
    let sub_path = get_app_setting(pool, "download_path".to_string())
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "MusicBox".to_string());

    let app_data_dir = _app_handle
        .path()
        .app_data_dir()
        .or_else(|_| Err("无法获取应用数据目录".to_string()))?;

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

    let source_path = app_data_dir.join("musicbox.db");

    // 2. 将基础目录与从数据库读取的子目录名拼接
    //    同时进行安全净化，防止 ".." 等路径遍历字符
    let download_path = base_path.join(sub_path.replace("..", ""));

    // 3. 确保最终的目录存在，如果不存在则创建
    if !download_path.exists() {
        tokio::fs::create_dir_all(&download_path)
            .await
            .map_err(|e| format!("创建下载目录 '{}' 失败: {}", download_path.display(), e))?;
    }

    let formatted_now_str = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true).replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "");

    let base_filename = format!("musicbox_{}.db", formatted_now_str);

    let initial_dest_path = download_path.join(&base_filename);

    let final_path: PathBuf;

    // 目标文件不存在，直接使用初始路径
    final_path = initial_dest_path;

    let ok: bool;

    // [优化] 使用异步文件复制 tokio::fs::copy，避免阻塞线程
    match tokio::fs::copy(&source_path, &final_path).await {
        Ok(_) => ok = true,
        Err(e) => {
            println!(
                "导出歌单失败: {} to {}, {}",
                source_path.display(),
                final_path.display(),
                e
            );
            ok = false
        }
    }

    if ok {
        #[cfg(target_os = "android")]
        let final_message = format!(
            "导出完成！文件已保存至手机 Download/{} 文件夹。",
            sub_path.replace("..", "")
        );
        #[cfg(not(target_os = "android"))]
        let final_message = format!("导出完成！");

        Ok(final_message)
    } else {
        Err(format!("导出失败。"))
    }
}
