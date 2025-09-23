// src-tauri/src/commands.rs

use super::my_util;
use crate::{
    model::{
        CacheAnalysisResult, CachedMusicInfo, Music, PlaylistCacheInfo, PlaylistInfo,
        PlaylistMusicItem, ToggleMusicPayload, UpdateDetailPayload,
    },
    music::{self},
    music_cache,
    my_util::DbPool,
    playlist::{self},
    updater,
};

use tauri::{AppHandle, ipc::Invoke};

#[tauri::command]
async fn save_music(music_list: Vec<Music>, state: tauri::State<'_, DbPool>) -> Result<(), String> {
    let pool = state.inner();
    music::save_music(pool, music_list)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_music_detail(
    app_handle: AppHandle,
    payload: UpdateDetailPayload,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    music::update_music_detail(&app_handle, state.inner(), payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_music_in_playlist(
    payload: ToggleMusicPayload,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    music::toggle_music_in_playlist(state.inner(), payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_playlist(state: tauri::State<'_, DbPool>) -> Result<i64, String> {
    playlist::create_playlist(state.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_playlist(playlist_id: i64, state: tauri::State<'_, DbPool>) -> Result<(), String> {
    playlist::delete_playlist(state.inner(), playlist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_playlist(
    playlist_id: i64,
    new_name: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    playlist::rename_playlist(state.inner(), playlist_id, new_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_playlists(
    song_id: Option<String>,
    state: tauri::State<'_, DbPool>,
) -> Result<Vec<PlaylistInfo>, String> {
    playlist::get_all_playlists(state.inner(), song_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_music_by_playlist_id(
    playlist_id: i64,
    state: tauri::State<'_, DbPool>,
) -> Result<Vec<PlaylistMusicItem>, String> {
    playlist::get_music_by_playlist_id(state.inner(), playlist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_app_setting(
    key: String,
    value: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    my_util::save_app_setting(state.inner(), key, value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_app_setting(
    key: String,
    state: tauri::State<'_, DbPool>,
) -> Result<Option<String>, String> {
    my_util::get_app_setting(state.inner(), key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_for_updates(
    app_handle: AppHandle,
    force: bool,
) -> Result<updater::UpdateInfo, String> {
    updater::check_for_updates(&app_handle, force).await
}

// 4. [新增] 忽略指定版本的 command
#[tauri::command]
async fn ignore_update(version: String, state: tauri::State<'_, DbPool>) -> Result<(), String> {
    my_util::save_app_setting(state.inner(), "ignore_version".to_string(), version)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_music_list_by_ids(
    song_ids: Vec<String>,
    state: tauri::State<'_, DbPool>,
) -> Result<Option<Vec<Music>>, String> {
    music::get_music_list_by_ids(state.inner(), song_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_music_cache_path(
    song_id: String,
    file_path: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    music::update_music_cache_path(state.inner(), &song_id, &file_path)
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn update_music_last_play_time(
    song_id: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    music::update_music_last_play_time(state.inner(), &song_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cache_music_and_get_file_path(
    app_handle: AppHandle,
    music: Music,
    state: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    music::cache_music_and_get_file_path(app_handle, state.inner(), music)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_music_file(
    app_handle: AppHandle,
    music_ids: Vec<String>,
    state: tauri::State<'_, DbPool>,
) -> Result<String, String> {
    music::export_music_file(app_handle, state.inner(), music_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cache_size(app_handle: AppHandle) -> Result<String, String> {
    music_cache::get_cache_size(app_handle)
}

#[tauri::command]
pub async fn get_non_playlist_cache_info(
    pool: tauri::State<'_, DbPool>,
) -> Result<CacheAnalysisResult, String> {
    music_cache::get_non_playlist_cache_info(pool.inner()).await
}

#[tauri::command]
pub async fn get_old_cache_info(
    pool: tauri::State<'_, DbPool>,
) -> Result<CacheAnalysisResult, String> {
    music_cache::get_old_cache_info(pool.inner()).await
}

#[tauri::command]
pub async fn get_all_playlists_cache_info(
    pool: tauri::State<'_, DbPool>,
) -> Result<Vec<PlaylistCacheInfo>, String> {
    music_cache::get_all_playlists_cache_info(pool.inner()).await
}

#[tauri::command]
pub async fn clear_cache_by_ids(
    app_handle: AppHandle, // [修改] 注入 AppHandle
    song_ids: Vec<String>,
    pool: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    // [修改] 将 app_handle 传递给核心函数
    music_cache::clear_cache_by_ids(&app_handle, pool.inner(), song_ids).await
}

#[tauri::command]
pub async fn get_cached_music_for_playlist(
    playlist_id: i64,
    pool: tauri::State<'_, DbPool>,
) -> Result<Vec<CachedMusicInfo>, String> {
    music_cache::get_cached_music_for_playlist(pool.inner(), playlist_id).await
}

#[tauri::command]
pub async fn update_playlist_cover(
    playlist_id: i64,
    cover_path: String,
    state: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    playlist::update_playlist_cover(state.inner(), playlist_id, cover_path)
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
        get_music_list_by_ids,
        update_music_cache_path,
        update_music_last_play_time,
        cache_music_and_get_file_path,
        export_music_file,
        get_cache_size,
        get_non_playlist_cache_info,
        get_old_cache_info,
        get_all_playlists_cache_info,
        clear_cache_by_ids,
        get_cached_music_for_playlist,
        update_playlist_cover,
    ]
}
