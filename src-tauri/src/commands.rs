// src-tauri/src/commands.rs

use crate::{
    db::{self, DbPool},
    model::{Music, PlaylistInfo, PlaylistMusic, ToggleMusicPayload, UpdateDetailPayload},
    updater,
};

use tauri::{AppHandle, ipc::Invoke};

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

#[tauri::command]
async fn check_for_updates(app_handle: AppHandle) -> Result<updater::UpdateInfo, String> {
    updater::check_for_updates(&app_handle).await
}

// 4. [新增] 忽略指定版本的 command
#[tauri::command]
async fn ignore_update(version: String, state: tauri::State<'_, db::DbPool>) -> Result<(), String> {
    db::save_app_setting(state.inner(), "ignore_version".to_string(), version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_music_detail_by_id(
    song_id: String,
    state: tauri::State<'_, db::DbPool>,
) -> Result<Option<Music>, String> {
    db::get_music_detail_by_id(state.inner(), song_id)
        .await
        .map_err(|e| e.to_string())
}

pub fn get_command_handler() -> impl Fn(Invoke) -> bool {
    tauri::generate_handler![
        save_music,
        update_music_detail,
        toggle_music_in_playlist,
        create_playlist,
        delete_playlist,
        rename_playlist,
        get_all_playlists,
        get_music_by_playlist_id,
        save_app_setting,
        get_app_setting,
        check_for_updates,
        ignore_update,
        get_music_detail_by_id,
    ]
}
