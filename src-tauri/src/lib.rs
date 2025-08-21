// src-tauri/src/lib.rs

pub mod commands;
pub mod db;
pub mod ffi;
pub mod model;
pub mod my_util;
pub mod updater;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::Manager; // 确保导入 Manager
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // [重要] 添加回 setup 钩子，用于初始化数据库
        .setup(|app| {
            // -- 菜单创建 --
            // 创建 "显示" 菜单项
            let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
            // 创建 "退出" 菜单项
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            // 创建菜单
            let menu = Menu::with_items(app, &[&show, &quit])?;

            // -- 系统托盘创建 --
            let _tray = TrayIconBuilder::new()
                .menu(&menu) // 绑定菜单
                .tooltip("你的音乐播放器") // 设置鼠标悬停提示
                // 从文件中加载图标
                .icon(Image::from_bytes(include_bytes!("../icons/icon.png"))?)
                .on_menu_event(move |app, event| {
                    // 监听菜单事件
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // 监听托盘图标事件
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
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let pool = my_util::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");
                app_handle.manage(pool);
            });

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // 阻止默认的关闭行为
                api.prevent_close();
                // 隐藏窗口
                window.hide().unwrap();
            }
            _ => {}
        })
        // [修改] 直接调用我们封装好的 handler 生成函数
        .invoke_handler(commands::get_command_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
