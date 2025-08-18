// src-tauri/src/updater.rs

use tauri::{App, Manager, WebviewWindow};
use serde::Deserialize;

// 将相关的结构体也一并移到这里
#[derive(Deserialize, Debug)]
struct PackageJson {
    version: String,
}

// 将函数声明为 pub，以便在其他模块中调用
pub async fn check_for_updates(app: App) {
    let current_version = app.package_info().version.to_string();
    // let package_json_url = "https://gitee.com/KrisShin/musicbox/raw/release/package.json";
    let package_json_url = "https://gitee.com/KrisShin/musicbox/raw/web/package.json";
    
    println!("正在检查更新，当前版本: v{}", current_version);

    let client = match app.http_client().build() {
        Ok(client) => client,
        Err(e) => {
            eprintln!("创建 HTTP 客户端失败: {}", e);
            return;
        }
    };
    
    let response = client.get(package_json_url).send().await;

    if let Ok(res) = response {
        if let Ok(pkg) = res.json::<PackageJson>().await {
            println!("获取到最新版本: v{}", pkg.version);
            
            if pkg.version.as_str() > current_version.as_str() {
                let new_version = pkg.version;
                
                let download_url = {
                    let cos_base_url = "https://YOUR_COS_URL"; // 替换为您的地址
                    
                    #[cfg(target_os = "windows")]
                    { format!("{}/v{}/musicbox_{}_x64_en-US.msi.zip", cos_base_url, new_version, new_version) }
                    #[cfg(target_os = "linux")]
                    { format!("{}/v{}/musicbox_{}_amd64.AppImage.tar.gz", cos_base_url, new_version, new_version) }
                    #[cfg(target_os = "macos")]
                    { format!("{}/v{}/musicbox_{}_x64.dmg.tar.gz", cos_base_url, new_version, new_version) }
                    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
                    { "https://gitee.com/YOUR_USERNAME/musicbox/releases" }
                };

                let main_window = app.get_webview_window("main").unwrap();
                let _ = main_window.dialog().message(format!(
                    "发现新版本 v{}！",
                    new_version
                )).title("版本更新").ok_button("前往下载").show(move |ok| {
                    if ok {
                        let _ = app.shell().open(&download_url, None);
                    }
                });
            } else {
                println!("当前已是最新版本。");
            }
        }
    } else {
        eprintln!("检查更新失败：无法访问 Gitee 上的 package.json");
    }
}