// src-tauri/src/updater.rs

use crate::db;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

// 1. [新增] 定义一个清晰的、将返回给前端的数据结构
#[derive(Serialize, Debug, Clone)]
pub struct UpdateInfo {
    pub update_available: bool,
    pub version: String,
    pub notes: String,
    pub download_url: String,
    pub download_password: String, // 新增下载密码字段
}

// 2. [新增] 用于解析 package.json 的结构体
#[derive(Deserialize, Debug)]
pub struct PackageJson {
    pub version: String,
    #[serde(rename = "releaseNotes")] // <-- [新增] 允许解析驼峰命名的 releaseNotes
    pub release_notes: Option<String>,
}

/// [重构] 核心检查逻辑，现在返回一个结构体给前端
pub async fn check_for_updates(app: &AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    // [修改] 使用您提供的 Gitee raw 链接
    let package_json_url = "https://gitee.com/KrisShin/musicbox/raw/release/package.json";

    // [修改] 使用您指定的固定网盘地址
    let static_download_url = "https://wwgv.lanzout.com/b0mbvaj4d";
    let static_download_password = "2pn7"; // <-- 请替换为您自己的网盘链接

    println!("正在检查更新，当前版本: v{}", current_version);

    let response = reqwest::get(package_json_url)
        .await
        .map_err(|e| e.to_string())?;

    // 1. 首先，检查响应的状态码
    if !response.status().is_success() {
        // 如果请求失败，返回错误
        return Err(format!("无法获取版本信息，状态码: {}", response.status()));
    }

    // 2. 然后，在确认请求成功后，再将响应体解析为 JSON
    // .json() 方法会消耗 response 对象并返回解析后的数据
    let pkg = response
        .json::<PackageJson>() // 假设 PackageJson 是您定义好的结构体
        .await
        .map_err(|e| e.to_string())?;

    let latest_version = pkg.version;

    println!("获取到最新版本: v{}", latest_version);

    // 3. [核心逻辑] 版本比较
    if latest_version.as_str() > current_version.as_str() {
        // 发现新版本，查询是否被忽略
        let pool = app.state::<db::DbPool>();
        let ignored_version = db::get_app_setting(pool.inner(), "ignore_version".to_string())
            .await
            .map_err(|e| e.to_string())?
            .unwrap_or_default(); // 如果不存在，默认为空字符串

        if latest_version == ignored_version {
            // 版本已被忽略
            println!("最新版本 v{} 已被用户忽略。", latest_version);
            Ok(UpdateInfo {
                update_available: false,
                version: latest_version,
                notes: "".to_string(),
                download_url: "".to_string(),
                download_password: "".to_string(),
            })
        } else {
            // 发现新版本且未被忽略
            println!("发现新版本 v{}！", latest_version);
            Ok(UpdateInfo {
                update_available: true,
                version: latest_version,
                notes: pkg
                    .release_notes
                    .unwrap_or_else(|| "优化了一些已知问题".to_string()),
                download_url: static_download_url.to_string(),
                download_password: static_download_password.to_string(),
            })
        }
    } else {
        // 当前已是最新版本
        println!("当前已是最新版本。");
        Ok(UpdateInfo {
            update_available: false,
            version: current_version,
            notes: "".to_string(),
            download_url: "".to_string(),
            download_password: "".to_string(),
        })
    }
}
