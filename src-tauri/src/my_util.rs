use base64::{Engine as _, engine::general_purpose};
use tauri_plugin_http::reqwest;

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
