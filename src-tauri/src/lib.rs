// src-tauri/src/lib.rs

pub mod commands;
pub mod music;
pub mod ffi;
pub mod model;
pub mod my_util;
pub mod updater;

use tauri::Manager; // 确保导入 Manager

#[cfg(desktop)]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    builder = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // --- 通用 Setup 逻辑 ---
            // 初始化数据库连接池
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let pool = my_util::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");
                app_handle.manage(pool);
            });

            // --- 仅桌面端的 Setup 逻辑 ---
            #[cfg(desktop)]
            {
                let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;

                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .tooltip("MusicBox") // 更新了一下提示文本
                    .icon(Image::from_bytes(include_bytes!("../icons/icon.png"))?)
                    .on_menu_event(move |app, event| match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .invoke_handler(commands::get_command_handler());
    // --- 仅桌面端的功能 ---
    #[cfg(desktop)]
    {
        // [改动] 条件性地添加窗口事件处理器
        builder = builder.on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().unwrap();
            }
        });
    }

    // --- 运行应用 ---
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
