use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

use crate::my_util::format_size;

pub fn get_cache_size(app_handle: AppHandle) -> Result<String, String> {
    // 1. 获取应用数据目录并构建缓存目录的完整路径
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {:?}", e))?;

    let cache_dir = app_data_dir.join("music_cache");

    // 2. 检查缓存目录是否存在，如果不存在，大小为 0
    if !cache_dir.is_dir() {
        return Ok("0 B".to_string());
    }

    // 3. 使用 `walkdir` 遍历目录下的所有文件
    //    `into_iter()` 创建一个迭代器
    //    `filter_map(Result::ok)` 忽略遍历过程中可能出现的错误
    //    `filter(|e| e.file_type().is_file())` 只保留文件类型的条目
    //    `filter_map(|e| e.metadata().ok())` 获取文件的元数据
    //    `map(|m| m.len())` 获取每个文件的大小
    //    `sum()` 将所有文件的大小相加
    let total_size = WalkDir::new(cache_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum::<u64>();

    // 4. 格式化总大小并返回
    Ok(format_size(total_size))
}
