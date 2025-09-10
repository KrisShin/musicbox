// src-tauri/src/lib.rs

pub mod commands;
pub mod ffi;
pub mod model;
pub mod music;
pub mod my_util;
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

// [核心改动] 升级本地媒体服务器以支持 Range Requests
fn start_media_server(cache_path: PathBuf) {
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
            let requested_file = match request.url().split('?').next() {
                Some(path) => path.trim_start_matches('/'),
                None => {
                    let _ = request.respond(tiny_http::Response::empty(404));
                    continue;
                }
            };

            let decoded_file = match urlencoding::decode(requested_file) {
                Ok(decoded) => decoded,
                Err(_) => {
                    let _ = request.respond(tiny_http::Response::empty(400));
                    continue;
                }
            };

            let file_path = cache_path.join(decoded_file.as_ref());

            if let Ok(mut file) = File::open(&file_path) {
                let total_size = file.metadata().map(|m| m.len()).unwrap_or(0);
                // [修复] 创建一个可复用的 header
                let accept_ranges_header =
                    tiny_http::Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap();

                // 检查是否有 Range 请求头
                if let Some(range_header) =
                    request.headers().iter().find(|h| h.field.equiv("Range"))
                {
                    let range_str = range_header.value.as_str();
                    if let Some(range) = parse_range(range_str, total_size) {
                        // 如果是范围请求
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
                            let _ = request.respond(tiny_http::Response::empty(500)); // Internal Server Error
                        }
                    } else {
                        // Range 请求头格式不正确，返回整个文件
                        let response =
                            tiny_http::Response::from_file(file).with_header(accept_ranges_header);
                        let _ = request.respond(response);
                    }
                } else {
                    // 如果没有 Range 请求头，返回整个文件
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
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    builder = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // --- 通用 Setup 逻辑 ---
            // 初始化数据库连接池
            let app_handle = app.handle().clone();

            if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                let cache_dir = app_data_dir.join("music_cache");
                if !cache_dir.exists() {
                    std::fs::create_dir_all(&cache_dir).expect("创建缓存目录失败");
                }
                start_media_server(cache_dir);
            }

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
