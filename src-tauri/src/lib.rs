// src-tauri/src/lib.rs

pub mod commands;
pub mod ffi;
pub mod model;
pub mod music;
pub mod music_cache;
pub mod my_util;
pub mod playlist;
pub mod updater;

use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::PathBuf,
};

use crate::my_util::{MEDIA_ADDR, parse_range};
use tauri::Manager; // 确保导入 Manager

#[cfg(desktop)]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};

fn start_media_server(base_data_path: PathBuf) {
    // 克隆路径以便在线程中使用
    let base_path = base_data_path.clone();

    std::thread::spawn(move || {
        let server_addr = MEDIA_ADDR;
        let server = match tiny_http::Server::http(server_addr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("无法启动本地媒体服务器: {}", e);
                return;
            }
        };
        println!("本地媒体服务器已在 http://{} 启动", server_addr);

        for request in server.incoming_requests() {
            let requested_url_path = match request.url().split('?').next() {
                Some(path) => path.trim_start_matches('/'),
                None => {
                    let _ = request.respond(tiny_http::Response::empty(404));
                    continue;
                }
            };

            let decoded_path_str = match urlencoding::decode(requested_url_path) {
                Ok(decoded) => decoded.into_owned(),
                Err(_) => {
                    let _ = request.respond(tiny_http::Response::empty(400)); // Bad Request
                    continue;
                }
            };

            // [核心修改 2] 安全和路由检查
            // 1. 安全检查：防止目录遍历攻击 (e.g., "music_cache/../../database.db")
            if decoded_path_str.contains("..") {
                let _ = request.respond(tiny_http::Response::empty(400)); // Bad Request
                continue;
            }

            // 2. 路由检查：确保请求的是我们允许的两个缓存目录之一
            let file_path: PathBuf;
            if decoded_path_str.starts_with("music_cache/")
                || decoded_path_str.starts_with("cover_cache/")
            {
                // 如果路径合法，则拼接基础路径
                file_path = base_path.join(&decoded_path_str);
            } else {
                // 否则，禁止访问
                eprintln!("Forbidden access attempt: {}", decoded_path_str);
                let _ = request.respond(tiny_http::Response::empty(403)); // Forbidden
                continue;
            }

            // 后续的文件服务逻辑 (Range Request等) 保持不变
            if let Ok(mut file) = File::open(&file_path) {
                let total_size = file.metadata().map(|m| m.len()).unwrap_or(0);
                let accept_ranges_header =
                    tiny_http::Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap();

                if let Some(range_header) =
                    request.headers().iter().find(|h| h.field.equiv("Range"))
                {
                    let range_str = range_header.value.as_str();
                    if let Some(range) = parse_range(range_str, total_size) {
                        let (start, end) = range;
                        let len = end - start + 1;

                        let mut buffer = vec![0; len as usize];
                        if file.seek(SeekFrom::Start(start)).is_ok()
                            && file.read_exact(&mut buffer).is_ok()
                        {
                            let response = tiny_http::Response::from_data(buffer)
                                .with_status_code(206) // Partial Content
                                .with_header(
                                    tiny_http::Header::from_bytes(
                                        &b"Content-Range"[..],
                                        format!("bytes {}-{}/{}", start, end, total_size)
                                            .as_bytes(),
                                    )
                                    .unwrap(),
                                )
                                .with_header(
                                    tiny_http::Header::from_bytes(
                                        &b"Content-Length"[..],
                                        len.to_string().as_bytes(),
                                    )
                                    .unwrap(),
                                )
                                .with_header(accept_ranges_header);
                            let _ = request.respond(response);
                        } else {
                            let _ = request.respond(tiny_http::Response::empty(500));
                        }
                    } else {
                        let response =
                            tiny_http::Response::from_file(file).with_header(accept_ranges_header);
                        let _ = request.respond(response);
                    }
                } else {
                    let response =
                        tiny_http::Response::from_file(file).with_header(accept_ranges_header);
                    let _ = request.respond(response);
                }
            } else {
                let _ = request.respond(tiny_http::Response::empty(404));
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // --- 通用 Setup 逻辑 ---
            // 初始化数据库连接池
            let app_handle = app.handle().clone();

            if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                // 1. 确保 music_cache 存在
                let music_cache_dir = app_data_dir.join("music_cache");
                if !music_cache_dir.exists() {
                    std::fs::create_dir_all(&music_cache_dir).expect("创建 music_cache 目录失败");
                }

                // 2. [新增] 确保 cover_cache 存在
                let cover_cache_dir = app_data_dir.join("cover_cache");
                if !cover_cache_dir.exists() {
                    std::fs::create_dir_all(&cover_cache_dir).expect("创建 cover_cache 目录失败");
                }

                // 3. 将父目录 (app_data_dir) 传递给服务器，使其可以访问其下的所有子目录
                start_media_server(app_data_dir);
            } else {
                eprintln!("严重错误：无法获取 app_data_dir！");
            }

            tauri::async_runtime::spawn(async move {
                // 1. 初始化数据库连接池
                let pool = my_util::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");

                // 2. 将连接池纳入 Tauri 的状态管理
                app_handle.manage(pool.clone()); // 克隆一份 pool 给状态管理

                // 3. 在这里触发自动清理任务
                //    现在我们可以确信 app_handle 和 pool 都是有效的
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                if let Err(e) = music_cache::run_auto_cache_cleanup(&app_handle, &pool).await {
                    eprintln!("[Startup Cleanup] Failed: {}", e);
                }
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
