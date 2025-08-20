use base64::{Engine as _, engine::general_purpose};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
use tauri_plugin_share::ShareExt;
use tokio::fs;

// 这是一个内部辅助函数，不再暴露给前端
pub async fn img_url_to_b64(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch image: status {}",
            response.status()
        ));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let image_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(&image_bytes);
    let data_url = format!("data:{};base64,{}", content_type, base64_str);

    Ok(data_url)
}

#[tauri::command]
pub async fn download_music(
    app_handle: AppHandle,
    url: String,
    title: String,
    artist: String,
) -> Result<String, String> {
    // --- 平台条件编译 ---

    // 目标平台是移动端 (Android/iOS)
    #[cfg(mobile)]
    {
        // 1. 先下载到应用私有的缓存目录，这里我们总是有权限
        let cache_dir = app_handle
            .path()
            .app_cache_dir()
            .or_else(|_| Err("无法获取下载目录".to_string()))?;

        // 确保文件名合法
        let filename = format!("{} - {}.mp3", title, artist);
        let temp_file_path = cache_dir.join(filename);

        // (下载逻辑与之前类似)
        let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("网络请求失败: {}", response.status()));
        }
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        fs::write(&temp_file_path, &bytes)
            .await
            .map_err(|e| e.to_string())?;

        // 2. (关键) 使用 share 插件分享已下载的文件
        let files_to_share: Vec<PathBuf> = vec![temp_file_path];

        tauri_plugin_share::share_file(&app_handle, files_to_share).map_err(|e| e.to_string())?;

        Ok(format!("Download/{}", filename))
    }

    // 目标平台是桌面端 (Windows/macOS/Linux)
    #[cfg(not(mobile))]
    {
        // 使用您之前在 Windows 上测试成功的静默下载逻辑
        let download_path = app_handle
            .path()
            .download_dir()
            .or_else(|_| Err("无法获取下载目录".to_string()))?;

        let base_filename = format!("{} - {}.mp3", title, artist);
        let mut final_path = download_path.join(&base_filename);
        let mut counter = 1;

        while final_path.exists() {
            let new_filename = format!("{} - {} ({}).mp3", title, artist, counter);
            final_path = download_path.join(new_filename);
            counter += 1;
        }

        let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("网络请求失败: {}", response.status()));
        }
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        fs::write(&final_path, &bytes)
            .await
            .map_err(|e| e.to_string())?;

        println!("文件成功下载至: {:?}", final_path);
        Ok(final_path
            .to_str()
            .ok_or("无法转换路径为字符串".to_string())?
            .to_string())
    }
}
