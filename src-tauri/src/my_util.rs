use sqlx::{SqlitePool, migrate::Migrator};
use std::fs::OpenOptions;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub type DbPool = SqlitePool;

pub const MEDIA_ADDR: &str = "127.0.0.1:38915";

pub fn parse_range(range_str: &str, total_size: u64) -> Option<(u64, u64)> {
    if !range_str.starts_with("bytes=") {
        return None;
    }
    let parts: Vec<&str> = range_str[6..].split('-').collect();
    if parts.len() != 2 {
        return None;
    }

    let start = parts[0].parse::<u64>().ok()?;
    let end = if parts[1].is_empty() {
        total_size - 1
    } else {
        parts[1].parse::<u64>().ok()?
    };

    if start > end || end >= total_size {
        None
    } else {
        Some((start, end))
    }
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

pub fn format_size(bytes: u64) -> String {
    const KIB: f64 = 1024.0;
    const MIB: f64 = KIB * 1024.0;
    const GIB: f64 = MIB * 1024.0;

    let size = bytes as f64;

    if size >= GIB {
        format!("{:.2} GB", size / GIB)
    } else if size >= MIB {
        format!("{:.2} MB", size / MIB)
    } else if size >= KIB {
        format!("{:.2} KB", size / KIB)
    } else {
        format!("{} B", bytes)
    }
}
