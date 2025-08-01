// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// use tauri::Runtime;

mod handle_music;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            handle_music::search_music,
            handle_music::download_song,
            handle_music::get_play_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
