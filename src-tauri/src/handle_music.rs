use lazy_static::lazy_static;
use rand::seq::SliceRandom; // 用于从切片中随机选择元素
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use scraper::{Html, Selector};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tokio::fs::File;
use tokio::io::AsyncWriteExt; // 用于创建静态的 Client
use tokio::time::{sleep, Duration}; // 用于异步延迟
use rand::Rng; // 用于生成随机数

// --- 1. 定义一个 User-Agent 列表，模拟不同的浏览器 ---
const USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:69.0) Gecko/20100101 Firefox/69.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36 OPR/63.0.3368.43",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18362",
    "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; LCTE; rv:11.0) like Gecko",
    "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/534.54.16 (KHTML, like Gecko) Version/5.1.4 Safari/534.54.16",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Safari/537.36 Core/1.70.3722.400 QQBrowser/10.5.3739.400",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36 QIHU 360SE",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36 QIHU 360EE",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 UBrowser/6.2.3964.2 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 SE 2.X MetaSr 1.0",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36 LBBROWSER",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.79 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3947.100 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
];

// --- 2. 使用 lazy_static 创建一个全局的、只初始化一次的 reqwest Client ---
// 这样做性能更好，并且可以复用TCP连接
lazy_static! {
    static ref HTTP_CLIENT: reqwest::Client = {
        let headers = HeaderMap::new();

        reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(15)) // 设置15秒的请求超时
            .build()
            .expect("Failed to build HTTP client")
    };
}

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

// --- 3. 重构 search_music 函数 ---
#[tauri::command]
pub async fn search_music(keyword: String, page: u32) -> Result<SearchResult, String> {
    let url = format!("https://www.gequhai.net/s/{}?page={}", keyword, page);
    println!("正在抓取 URL: {}", url);

    // 从我们的列表中随机选择一个 User-Agent
    let user_agent = USER_AGENTS
        .choose(&mut rand::thread_rng())
        .unwrap_or(&USER_AGENTS[0]);

    let response = HTTP_CLIENT
        .get(&url)
        .header(USER_AGENT, *user_agent) // 为本次请求设置随机的 User-Agent
        .header(
            "Referer",
            HeaderValue::from_static("https://www.gequhai.net/"),
        ) // 添加 Referer，表明我们是从主站访问的
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?; // 优化错误处理

    // 检查HTTP状态码，如果不是 200 OK，就说明请求可能被阻止了
    if !response.status().is_success() {
        return Err(format!("请求失败，状态码: {}", response.status()));
    }

    let response_html = response
        .text()
        .await
        .map_err(|e| format!("读取响应内容失败: {}", e))?;

    if response_html.is_empty() {
        return Err("服务器返回了空内容".to_string());
    }

    // --- 解析逻辑保持不变 ---
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
    // --- (No more `let mut rng` here) ---

    let detail_url = format!(
        "https://www.gequhai.net/search_music?song_id={}&kwd={}&title={}&singer={}",
        song_id, keyword, title, artist
    );
    println!("详情页面链接 {}", detail_url);

    let detail_referer = format!("https://www.gequhai.net/s/{}", keyword);

    // 1. Get a fresh `thread_rng` instance just for this line.
    let user_agent = USER_AGENTS
        .choose(&mut rand::thread_rng())
        .unwrap_or(&USER_AGENTS[0]);

    let detail_html = HTTP_CLIENT
        .get(&detail_url)
        .header(USER_AGENT, *user_agent)
        .header(
            "Referer",
            HeaderValue::from_str(&detail_referer).map_err(|e| format!("Referer header无效: {}", e))?,
        )
        .send()
        .await // The await point that `rng` cannot cross
        .map_err(|e| format!("访问详情页失败: {}", e))?
        .text()
        .await
        .map_err(|e| format!("读取详情页内容失败: {}", e))?;

    lazy_static! {
        static ref RE: Regex = Regex::new(r"window\.appData = (\{.*?\});").unwrap();
    }
    let caps = RE.captures(&detail_html).ok_or("在页面中未找到 appData")?;
    let json_str = &caps[1];

    let app_data: AppData =
        serde_json::from_str(json_str).map_err(|e| format!("解析 appData JSON 失败: {}", e))?;

    // 2. Get another fresh `thread_rng` instance just for this line.
    let delay_ms = rand::thread_rng().gen_range(1200..3000);
    println!("模拟用户行为，延迟 {} 毫秒...", delay_ms);
    sleep(Duration::from_millis(delay_ms)).await;


    let final_download_url = format!("https://www.gequhai.net/api/down_mp3/{}", app_data.mp3_id);
    println!("解析得到下载直链: {}", final_download_url);

    // ... (rest of the function is correct) ...
    let response = HTTP_CLIENT
        .get(&final_download_url)
        .header(USER_AGENT, *user_agent)
        .header("Referer", &detail_url)
        .send()
        .await
        .map_err(|e| format!("下载最终文件失败: {}", e))?;

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    println!("下载链接的 Content-Type: {}", content_type);

    if !content_type.starts_with("audio/") && !content_type.starts_with("application/octet-stream")
    {
        return Err(format!(
            "链接已失效或超时,请前往网盘自行下载:{}",
            format!("https://www.gequhai.net/api/down_url/{}", app_data.mp3_id)
        ));
    }

    let song_data = response.bytes().await.map_err(|e| e.to_string())?;

    let suggested_filename = format!("{} - {}.mp3", artist, title);
    let file_path_option = app
        .dialog()
        .file()
        .set_title("请选择保存位置")
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