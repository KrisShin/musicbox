use base64::{Engine as _, engine::general_purpose};
use sqlx::{SqlitePool, migrate::Migrator};
use std::fs::OpenOptions;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub type DbPool = SqlitePool;

// 这是一个内部辅助函数，不再暴露给前端
pub async fn img_url_to_b64(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch image: status {}",
            response.status()
        ));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let image_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(&image_bytes);
    let data_url = format!("data:{};base64,{}", content_type, base64_str);

    Ok(data_url)
}

#[tauri::command]
pub async fn download_music_desktop(
    app_handle: AppHandle,
    url: String,
    title: String,
    artist: String,
) -> Result<String, String> {
    // 您的桌面端下载逻辑是完美的，我们直接使用它
    let download_path = app_handle
        .path()
        .download_dir()
        .or_else(|_| Err("无法获取下载目录".to_string()))?;

    let base_filename = format!("{} - {}.mp3", title, artist);
    let mut final_path = download_path.join(&base_filename);
    let mut counter = 1;

    while final_path.exists() {
        let new_filename = format!("{} - {} ({}).mp3", title, artist, counter);
        final_path = download_path.join(new_filename);
        counter += 1;
    }

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("网络请求失败: {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&final_path, &bytes)
        .await
        .map_err(|e| e.to_string())?;

    println!("文件成功下载至: {:?}", final_path);
    Ok(final_path
        .to_str()
        .ok_or("无法转换路径为字符串".to_string())?
        .to_string())
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
