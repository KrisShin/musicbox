#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use musicbox_lib::db::{self, DbPool, Music, UpdateDetailPayload};
use tauri::Manager;

// 一个示例 command，展示如何从 State 中获取连接池
#[tauri::command]
async fn some_database_operation(
    state: tauri::State<'_, DbPool>, // 直接使用类型别名 DbPool
) -> Result<String, String> {
    // let pool = state.inner();
    // ... 在这里使用 pool 执行数据库操作
    println!("成功从 Command 中获取到数据库连接池！");
    Ok("操作成功".to_string())
}

// 2. 创建一个新的 Tauri command
#[tauri::command]
async fn save_music(
    songs: Vec<Music>, // Tauri 会自动将前端传来的 JSON 数组反序列化为 Vec<Song>
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    let pool = state.inner();
    db::save_music(pool, songs).await.map_err(|e| e.to_string()) // 将 sqlx::Error 转换为 String 以便返回给前端
}

#[tauri::command]
async fn update_music_detail(
    payload: UpdateDetailPayload, // <-- 接收新的、意图明确的 payload
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    db::update_music_detail(state.inner(), payload)
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // 将这个全新的、'static 的 app_handle 移动到异步任务中
            tauri::async_runtime::spawn(async move {
                // 现在这个异步块拥有了 app_handle 的所有权，可以安全地使用它
                let pool = db::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");

                // 使用这个 handle 来管理状态
                app_handle.manage(pool);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            some_database_operation,
            save_music,
            update_music_detail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
