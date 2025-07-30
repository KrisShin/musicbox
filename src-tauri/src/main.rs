// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// 在 main.rs 文件的顶部，use 语句的下方添加
#[derive(serde::Serialize, Clone)]
struct Song {
    id: u32,
    title: String,
    artist: String,
    album: String,
    duration: u32, // 时长（秒）
}

// 将这个函数添加到 Song 结构体定义的下方
#[tauri::command]
async fn search_music(keyword: String) -> Result<Vec<Song>, String> {
    println!("Searching for: {}", keyword); // 在后端打印日志，方便调试

    // --- 模拟网络请求和数据解析 ---
    // 为了演示，我们返回一些固定的假数据
    // 未来你可以将这里替换为真实的 HTTP 请求和对音乐 API 的调用
    let mock_songs = vec![
        Song {
            id: 1,
            title: format!("关于 {} 的歌曲一", keyword),
            artist: "歌手A".to_string(),
            album: "专辑X".to_string(),
            duration: 245,
        },
        Song {
            id: 2,
            title: format!("{} 的奇妙旅程", keyword),
            artist: "乐队B".to_string(),
            album: "专辑Y".to_string(),
            duration: 198,
        },
        Song {
            id: 3,
            title: "七里香".to_string(),
            artist: "周杰伦".to_string(),
            album: "七里香".to_string(),
            duration: 298,
        },
    ];

    // 模拟网络延迟
    // tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(mock_songs)
}
// 在 main.rs 文件中找到 main 函数
fn main() {
    tauri::Builder::default()
        // 将原来的 generate_handler! 修改或替换成这样
        .invoke_handler(tauri::generate_handler![search_music]) // <--- 修改这里
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
