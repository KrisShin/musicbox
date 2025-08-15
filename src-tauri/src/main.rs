// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// [核心改动] 直接从我们的库中 use 所有东西
use musicbox_lib::{commands, db};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let pool = db::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");
                app_handle.manage(pool);
            });

            Ok(())
        })
        // [核心改动] invoke_handler 现在直接使用库中的 command
        .invoke_handler(commands::get_command_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
