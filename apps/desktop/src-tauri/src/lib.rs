use tauri::{Manager, RunEvent};

/// 下载图片到本地：拉取远程字节 -> 弹原生保存对话框 -> 写入文件。
/// 返回 Ok(Some(path)) 表示已保存；Ok(None) 表示用户取消。
#[tauri::command]
async fn download_image(
    app_handle: tauri::AppHandle,
    url: String,
    suggested_name: String,
) -> Result<Option<String>, String> {
    // 1. 拉取图片字节
    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载失败: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("读取数据失败: {e}"))?;

    // 2. 弹出原生保存对话框
    use tauri_plugin_dialog::DialogExt;
    let file_path = app_handle
        .dialog()
        .file()
        .set_file_name(&suggested_name)
        .save_file()
        .await;

    let Some(file_path) = file_path else {
        return Ok(None);
    };

    let path = file_path.into_path().map_err(|e| format!("路径无效: {e}"))?;

    // 3. 写入文件
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| format!("写入文件失败: {e}"))?;

    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![download_image])
        .setup(|app| {
            // macOS: Cmd+W 隐藏窗口（后台运行），而非关闭退出
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // macOS: 点击 Dock 图标重新显示窗口
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}
