use base64::{Engine as _, engine::general_purpose};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;
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
pub async fn download_music_file(
    app_handle: AppHandle, // <-- 添加 AppHandle 参数
    url: String,
    title: String,
    artist: String,
) -> Result<String, String> {
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

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("下载请求失败，状态: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取响应体失败: {}", e))?;

    fs::write(&final_path, &bytes)
        .await
        .map_err(|e| format!("文件写入失败: {:?}", e))?;

    println!("文件成功下载至: {:?}", final_path);
    Ok(final_path
        .to_str()
        .ok_or("无法转换路径为字符串".to_string())?
        .to_string())
}
