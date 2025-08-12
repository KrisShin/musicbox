// src-tauri/src/db.rs

use serde::Deserialize;
use sqlx::{SqlitePool, migrate::Migrator};
use std::{fs::OpenOptions, path::PathBuf};
use tauri::{AppHandle, Manager}; // 注意这里我们直接使用 AppHandle

// 定义一个公开的静态 MIGRATOR
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

// 定义一个公开的数据库连接池类型别名，方便在其他地方使用
pub type DbPool = SqlitePool;

#[derive(Debug, Deserialize)]
pub struct MusicOptionalDetails {
    pub lyric: Option<String>,
    pub cover_url: Option<String>,
    #[serde(rename = "duration")]
    pub duration_secs: Option<f64>,
    pub play_url: Option<String>,
    
    // 这两个字段在详情页也能获取到，也放在这里
    pub download_mp3: Option<String>,
    pub download_kuake: Option<String>,
    pub download_mp3_id: Option<String>,
}

// 2. [完整歌曲模型] - 用于创建新歌曲
// 它通过组合的方式，“继承”了 SongOptionalDetails 的所有字段
#[derive(Debug, Deserialize)]
pub struct Music {
    // 必需的核心字段
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub url: String,
    
    // 使用 #[serde(flatten)] 将所有详情字段“拍平”合并进来
    // 前端传来的 JSON 无需任何改变！
    #[serde(flatten)]
    pub details: MusicOptionalDetails,
}

// 3. [更新详情载荷] - 用于更新歌曲详情的专用 DTO
// 非常清晰地表达了“我需要用这些详情来更新哪个 song_id”
#[derive(Debug, Deserialize)]
pub struct UpdateDetailPayload {
    pub song_id: String,
    #[serde(flatten)]
    pub details: MusicOptionalDetails,
}

/// 核心函数：初始化数据库并返回连接池
/// 它的设计是平台无关的，只需要一个能提供数据目录路径的 AppHandle
pub async fn init_db_pool(app_handle: &AppHandle) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("未能找到应用数据目录");

    // 步骤 1: 确保父目录存在
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path: PathBuf = app_data_dir.join("musicbox.db");

    // *** 这是最关键的修正 ***
    // 步骤 2: 如果数据库文件不存在，则明确地创建它
    if !db_path.exists() {
        // 使用 OpenOptions 来创建文件。
        // .write(true) 开启写模式
        // .create(true) 如果文件不存在则创建
        OpenOptions::new().write(true).create(true).open(&db_path)?;
    }

    let connection_string = format!("sqlite:{}", db_path.to_str().expect("数据库路径无效"));

    // 步骤 3: 现在可以安全地连接了
    let pool = SqlitePool::connect(&connection_string).await?;

    // 步骤 4: 运行迁移
    MIGRATOR.run(&pool).await?;

    Ok(pool)
}

/// 核心函数：保存一批歌曲到数据库
/// 如果歌曲已存在 (基于 song_id)，则更新其信息
pub async fn save_music(pool: &DbPool, songs: Vec<Music>) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // SQL 语句现在引用 details 里的字段
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

    for song in songs {
        // 注意这里我们如何从组合的结构体中取值
        sqlx::query(sql)
            .bind(&song.song_id)
            .bind(&song.title)
            .bind(&song.artist)
            .bind(&song.url)
            .bind(&song.details.lyric)
            .bind(&song.details.download_mp3)
            .bind(&song.details.download_kuake)
            .bind(&song.details.cover_url)
            .bind(song.details.duration_secs)
            .bind(song.details.download_mp3_id)
            .bind(&song.details.play_url)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// 核心函数：根据 song_id 更新一首歌曲的详情信息
pub async fn update_music_detail(pool: &DbPool, payload: UpdateDetailPayload) -> Result<(), sqlx::Error> {
    // 2. 准备一个 UPDATE SQL 语句
    // 我们只更新详情相关的字段，不触碰 title, artist 等基础信息
    let sql = r#"
        UPDATE music SET
            lyric = ?, cover_url = ?, duration_secs = ?, play_url = ?,
            download_mp3 = ?, download_kuake = ?, download_mp3_id = ?
        WHERE song_id = ?
    "#;

    // 直接使用 payload 中的字段，意图清晰
    sqlx::query(sql)
        .bind(&payload.details.lyric)
        .bind(&payload.details.cover_url)
        .bind(payload.details.duration_secs)
        .bind(&payload.details.play_url)
        .bind(&payload.details.download_mp3)
        .bind(&payload.details.download_kuake)
        .bind(payload.details.download_mp3_id)
        .bind(&payload.song_id)
        .execute(pool)
        .await?;

    Ok(())
}
