// アプリ設定ディレクトリ内でのダッシュボード専用ファイルの読み込みと、アトミック保存を行う

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::file_ops::atomic_write;

/// ダッシュボードファイルの保存先パスを取得する
fn get_dashboard_path(app: &AppHandle, workspace_id: &str) -> Result<PathBuf, String> {
    // Tauriのアプリデータディレクトリを取得 (Obsidianのフォルダは汚さない)
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    // ディレクトリが存在しなければ作成
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }

    Ok(app_data_dir.join(format!("dashboard_{}.md", workspace_id)))
}

#[tauri::command]
pub fn load_dashboard(app: AppHandle, workspace_id: String) -> Result<String, String> {
    let path = get_dashboard_path(&app, &workspace_id)?;
    
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        // 初回起動時のデフォルトコンテンツ
        Ok(format!("# Dashboard\n\nWelcome to your workspace dashboard!\n\n```obcowa-tasks\n```\n"))
    }
}

#[tauri::command]
pub fn save_dashboard(app: AppHandle, workspace_id: String, content: String) -> Result<(), String> {
    let path = get_dashboard_path(&app, &workspace_id)?;
    // 既存の安全な上書き保存関数を利用
    atomic_write(&path, content.as_bytes())
}