// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod handle_music;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // 在这里添加 get_play_url
        .invoke_handler(tauri::generate_handler![
            handle_music::search_music,
            handle_music::download_song,
            handle_music::get_play_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
