use regex::Regex;
use scraper::{Html, Selector};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

#[derive(serde::Serialize, Clone, Debug)]
pub struct Song {
    id: String,
    title: String,
    artist: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SearchResult {
    songs: Vec<Song>,
    has_more: bool,
}

#[derive(serde::Deserialize, Debug)]
pub struct AppData {
    mp3_id: u32,
}

#[tauri::command]
pub async fn search_music(keyword: String, page: u32) -> Result<SearchResult, String> {
    let url = format!("https://www.gequhai.net/s/{}?page={}", keyword, page);
    println!("正在抓取 URL: {}", url);

    let response_html = match reqwest::get(&url).await {
        Ok(response) => response.text().await.unwrap_or_default(),
        Err(e) => return Err(format!("网络请求失败: {}", e)),
    };

    let document = Html::parse_document(&response_html);
    let row_selector = Selector::parse("div.row").unwrap();
    let title_selector = Selector::parse("span.music-title > span").unwrap();
    let artist_selector = Selector::parse("small.text-jade").unwrap();
    let link_selector = Selector::parse("a.music-link").unwrap();
    let mut songs: Vec<Song> = Vec::new();

    for row in document.select(&row_selector) {
        let title = row.select(&title_selector).next().map(|t| t.inner_html());
        let artist = row.select(&artist_selector).next().map(|a| a.inner_html());
        let link = row
            .select(&link_selector)
            .next()
            .and_then(|a| a.value().attr("href"));
        if let (Some(title), Some(artist), Some(href)) = (title, artist, link) {
            if let Some(song_id_str) = href
                .split("song_id=")
                .nth(1)
                .and_then(|s| s.split('&').next())
            {
                songs.push(Song {
                    id: song_id_str.to_string(),
                    title: title.trim().to_string(),
                    artist: artist.trim().to_string(),
                });
            }
        }
    }

    let next_page_selector = Selector::parse("a[rel='next']").unwrap();
    let has_more = document.select(&next_page_selector).next().is_some();
    println!(
        "成功解析到 {} 首歌曲, 是否有更多: {}",
        songs.len(),
        has_more
    );

    Ok(SearchResult { songs, has_more })
}

// 新增用于解析播放API响应的结构体
#[derive(serde::Deserialize, Debug)]
struct PlayUrlData {
    url: String,
}

#[derive(serde::Deserialize, Debug)]
struct PlayUrlResponse {
    code: i32,
    data: PlayUrlData,
}

#[tauri::command]
pub async fn get_play_url(
    song_id: String,
    title: String,
    artist: String,
    keyword: String,
) -> Result<String, String> {
    let detail_url = format!(
        "https://www.gequhai.net/search_music?song_id={}&kwd={}&title={}&singer={}",
        song_id, keyword, title, artist
    );
    println!("获取播放链接，访问详情页: {}", detail_url);

    let detail_html = match reqwest::get(&detail_url).await {
        Ok(resp) => resp.text().await.map_err(|e| e.to_string())?,
        Err(e) => return Err(format!("访问详情页失败: {}", e)),
    };

    // 解析 play_id
    let re = Regex::new(r"window\.play_id = '(.*?)';").unwrap();
    let caps = re.captures(&detail_html).ok_or("在页面中未找到 play_id")?;
    let play_id = &caps[1];
    println!("解析到 play_id: {}", play_id);

    // 请求播放API
    let client = reqwest::Client::new();
    let params = [("id", play_id)];
    let res = client
        .post("https://www.gequhai.net/api/play-url")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("请求播放API失败: {}", e))?;

    let play_response: PlayUrlResponse = res
        .json()
        .await
        .map_err(|e| format!("解析播放API响应失败: {}", e))?;

    if play_response.code == 1 {
        println!("获取到播放直链: {}", play_response.data.url);
        Ok(play_response.data.url)
    } else {
        Err("播放API返回错误".to_string())
    }
}

#[tauri::command]
pub async fn download_song(
    app: AppHandle,
    song_id: String,
    title: String,
    artist: String,
    keyword: String,
) -> Result<(), String> {
    let detail_url = format!(
        "https://www.gequhai.net/search_music?song_id={}&kwd={}&title={}&singer={}",
        song_id, keyword, title, artist
    );
    println!("获取下载链接，访问详情页: {}", detail_url);

    let detail_html = match reqwest::get(&detail_url).await {
        Ok(resp) => resp.text().await.map_err(|e| e.to_string())?,
        Err(e) => return Err(format!("访问详情页失败: {}", e)),
    };

    let re = Regex::new(r"window\.appData = (\{.*?\});").unwrap();
    let caps = re.captures(&detail_html).ok_or("在页面中未找到 appData")?;
    let json_str = &caps[1];

    let app_data: AppData =
        serde_json::from_str(json_str).map_err(|e| format!("解析 appData JSON 失败: {}", e))?;

    let final_download_url = format!("https://www.gequhai.net/api/down_mp3/{}", app_data.mp3_id);
    println!("解析得到下载直链: {}", final_download_url);

    // --- 核心改动开始 ---
    let resp = reqwest::get(&final_download_url)
        .await
        .map_err(|e| e.to_string())?;

    // 检查响应头中的 Content-Type
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    println!("下载链接的 Content-Type: {}", content_type);

    // 如果内容类型不是音频或通用二进制流，则认为是无效链接
    if !content_type.starts_with("audio/") && !content_type.starts_with("application/octet-stream")
    {
        // 返回一个带下载链接的特定错误信息
        return Err(format!("链接已失效或超时,请在浏览器中尝试:{}", detail_url));
    }

    let song_data = resp.bytes().await.map_err(|e| e.to_string())?;
    // --- 核心改动结束 ---

    let suggested_filename = format!("{} - {}.mp3", artist, title);

    let file_path_option = app
        .dialog()
        .file()
        .set_file_name(&suggested_filename)
        .add_filter("MP3 Audio", &["mp3"])
        .blocking_save_file();

    if let Some(FilePath::Path(path_buf)) = file_path_option {
        println!("用户选择保存路径: {:?}", path_buf);
        match File::create(path_buf).await {
            Ok(mut file) => {
                if let Err(e) = file.write_all(&song_data).await {
                    return Err(format!("写入文件失败: {}", e));
                }
            }
            Err(e) => return Err(format!("创建文件失败: {}", e)),
        }
    } else {
        return Err("用户取消了下载或路径无效".to_string());
    }

    Ok(())
}
