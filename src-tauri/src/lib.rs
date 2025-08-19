// src-tauri/src/lib.rs

pub mod commands;
pub mod db;
pub mod ffi;
pub mod updater;

use tauri::Manager; // 确保导入 Manager

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // [重要] 添加回 setup 钩子，用于初始化数据库
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
        // [修改] 直接调用我们封装好的 handler 生成函数
        .invoke_handler(commands::get_command_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
