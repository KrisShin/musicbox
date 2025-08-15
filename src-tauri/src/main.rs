#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use musicbox_lib::db::{
    self, DbPool, Music, PlaylistInfo, PlaylistMusic, ToggleMusicPayload, UpdateDetailPayload,
};
use tauri::Manager;

// #[tauri::command]
// async fn some_database_operation(state: tauri::State<'_, DbPool>) -> Result<String, String> {
//     println!("成功从 Command 中获取到数据库连接池！");
//     Ok("操作成功".to_string())
// }

#[tauri::command]
async fn save_music(music_list: Vec<Music>, state: tauri::State<'_, DbPool>) -> Result<(), String> {
    let pool = state.inner();
    db::save_music(pool, music_list)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_music_detail(
    payload: UpdateDetailPayload,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    db::update_music_detail(state.inner(), payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_music_in_playlist(
    payload: ToggleMusicPayload,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    db::toggle_music_in_playlist(state.inner(), payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_playlist(name: String, state: tauri::State<'_, DbPool>) -> Result<i64, String> {
    db::create_playlist(state.inner(), name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_playlist(playlist_id: i64, state: tauri::State<'_, DbPool>) -> Result<(), String> {
    db::delete_playlist(state.inner(), playlist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_playlist(
    playlist_id: i64,
    new_name: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    db::rename_playlist(state.inner(), playlist_id, new_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_playlists(
    song_id: Option<String>,
    state: tauri::State<'_, DbPool>,
) -> Result<Vec<PlaylistInfo>, String> {
    db::get_all_playlists(state.inner(), song_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_music_by_playlist_id(
    playlist_id: i64,
    state: tauri::State<'_, DbPool>,
) -> Result<Vec<PlaylistMusic>, String> {
    db::get_music_by_playlist_id(state.inner(), playlist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_app_setting(
    key: String,
    value: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    db::save_app_setting(state.inner(), key, value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_app_setting(
    key: String,
    state: tauri::State<'_, DbPool>,
) -> Result<Option<String>, String> {
    db::get_app_setting(state.inner(), key)
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

            tauri::async_runtime::spawn(async move {
                let pool = db::init_db_pool(&app_handle)
                    .await
                    .expect("数据库初始化失败");

                app_handle.manage(pool);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // some_database_operation,
            save_music,
            update_music_detail,
            toggle_music_in_playlist,
            create_playlist,
            delete_playlist,
            rename_playlist,
            get_all_playlists,
            get_music_by_playlist_id,
            save_app_setting,
            get_app_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
