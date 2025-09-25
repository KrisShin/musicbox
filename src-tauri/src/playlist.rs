use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use chrono::Local;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;
use tokio::fs;

use crate::{
    model::{AppSetting, Music, Playlist, PlaylistInfo, PlaylistMusicItem},
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

    let formatted_now_str = Local::now().format("%Y%m%d_%H%M%S").to_string();

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

pub async fn import_database_from_bytes(
    app: AppHandle,
    bytes: Vec<u8>, // 接收文件内容而不是路径
    mode: &str,
) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("导入的文件内容为空".to_string());
    }

    // 1. 将接收到的字节写入一个临时文件，因为 sqlx 需要一个文件路径来连接
    let temp_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| Err("无法获取缓存目录"))?;
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| e.to_string())?;
    }
    let temp_import_path = temp_dir.join("import_temp.db");
    fs::write(&temp_import_path, bytes)
        .await
        .map_err(|e| format!("创建临时导入文件失败: {}", e))?;

    // 获取当前应用的数据库路径
    let db_path = app
        .path()
        .app_data_dir()
        .or_else(|_| Err("无法获取应用数据目录"))?
        .join("musicbox.db");

    // 2. 在操作前关闭主数据库连接池
    let pool = app.state::<SqlitePool>().inner().clone();
    pool.close().await;

    // 3. 执行导入逻辑
    let result = match mode {
        "replace" => handle_replace(&temp_import_path, &db_path).await,
        "merge" => handle_merge(&temp_import_path, &db_path).await,
        _ => Err("无效的导入模式".to_string()),
    };

    // 4. [重要] 清理临时文件
    let _ = fs::remove_file(&temp_import_path).await;

    // 5. 返回结果
    if result.is_ok() {
        Ok("导入成功！请重启应用以使更改生效。".to_string())
    } else {
        let bak_path = db_path.with_extension("db.bak");
        if bak_path.exists() {
            let _ = fs::rename(bak_path, &db_path).await;
        }
        Err(format!(
            "导入失败: {}. 数据库未更改，请重启应用。",
            result.unwrap_err()
        ))
    }
}

async fn handle_replace(import_path: &Path, db_path: &Path) -> Result<(), String> {
    fs::copy(import_path, db_path)
        .await
        .map_err(|e| format!("替换数据库文件失败: {}", e))?;
    Ok(())
}

async fn handle_merge(import_path: &Path, db_path: &Path) -> Result<(), String> {
    // 1. 备份当前数据库
    let bak_path = db_path.with_extension("db.bak");
    fs::copy(db_path, &bak_path)
        .await
        .map_err(|e| format!("创建备份失败: {}", e))?;

    // 2. 重新连接到当前数据库
    let current_pool = SqlitePool::connect(&db_path.to_string_lossy())
        .await
        .map_err(|e| format!("无法重新连接到当前数据库: {}", e))?;

    // 3. 连接到要导入的数据库
    let import_pool = SqlitePool::connect(&import_path.to_string_lossy())
        .await
        .map_err(|e| format!("无法打开导入的数据库文件: {}", e))?;

    // 4. 开始事务
    let mut tx = current_pool.begin().await.map_err(|e| e.to_string())?;

    // 5. 合并 `music` 表 (这部分逻辑是安全的)
    let musics: Vec<Music> = sqlx::query_as("SELECT * FROM music")
        .fetch_all(&import_pool)
        .await
        .map_err(|e| e.to_string())?;
    for music in musics {
        sqlx::query("INSERT OR IGNORE INTO music (song_id, title, artist, url, lyric, cover_url, duration_secs, play_url, download_mp3, download_extra, download_mp3_id, play_id, file_path, last_played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(music.song_id).bind(music.title).bind(music.artist).bind(music.url).bind(music.lyric).bind(music.cover_url).bind(music.duration_secs).bind(music.play_url).bind(music.download_mp3).bind(music.download_extra).bind(music.download_mp3_id).bind(music.play_id).bind(music.file_path).bind(music.last_played_at)
            .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }

    // 6. [关键] 合并 `playlist` 表并建立 ID 映射
    let mut playlist_id_map: HashMap<i64, i64> = HashMap::new();
    let import_playlists: Vec<Playlist> = sqlx::query_as("SELECT * FROM playlist")
        .fetch_all(&import_pool)
        .await
        .map_err(|e| e.to_string())?;

    for p in import_playlists {
        // 尝试在当前数据库中查找同名歌单
        let existing_playlist: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM playlist WHERE name = ?")
                .bind(&p.name)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;

        if let Some((existing_id,)) = existing_playlist {
            // 如果歌单已存在，则将旧 ID 映射到已存在的 ID
            playlist_id_map.insert(p.id, existing_id);
        } else {
            // 如果歌单不存在，则插入新歌单并获取新 ID
            let result = sqlx::query("INSERT INTO playlist (name, cover_path) VALUES (?, ?)")
                .bind(&p.name)
                .bind(&p.cover_path)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
            let new_id = result.last_insert_rowid();
            // 将旧 ID 映射到新生成的 ID
            playlist_id_map.insert(p.id, new_id);
        }
    }

    // 7. [关键] 使用 ID 映射合并 `playlist_music` 关联表
    let relations: Vec<(i64, String, Option<i64>)> =
        sqlx::query_as("SELECT playlist_id, song_id, position FROM playlist_music")
            .fetch_all(&import_pool)
            .await
            .map_err(|e| e.to_string())?;

    for (old_playlist_id, song_id, position) in relations {
        // 从 map 中找到旧 playlist_id 对应的新 new_playlist_id
        if let Some(&new_playlist_id) = playlist_id_map.get(&old_playlist_id) {
            sqlx::query("INSERT OR IGNORE INTO playlist_music (playlist_id, song_id, position) VALUES (?, ?, ?)")
                .bind(new_playlist_id) // 使用新的 playlist_id
                .bind(song_id)
                .bind(position)
                .execute(&mut *tx)
                .await.map_err(|e| e.to_string())?;
        }
    }

    // 8. 合并 `app_setting` 表 (使用 REPLACE 策略，保持不变)
    let settings: Vec<AppSetting> = sqlx::query_as("SELECT * FROM app_setting")
        .fetch_all(&import_pool)
        .await
        .map_err(|e| e.to_string())?;
    for setting in settings {
        sqlx::query("INSERT OR IGNORE INTO app_setting (key, value) VALUES (?, ?)")
            .bind(setting.key)
            .bind(setting.value)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 9. 提交事务
    tx.commit().await.map_err(|e| e.to_string())?;

    // 10. 关闭连接池
    import_pool.close().await;
    current_pool.close().await;

    // 11. 删除备份
    fs::remove_file(bak_path).await.ok();

    Ok(())
}
