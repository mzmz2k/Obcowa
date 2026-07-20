use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};
// lib.rs で定義されている Workspace 構造体を使えるように読み込む
use crate::Workspace;

/// 💥 安全にファイルを保存するアトミック書き込み関数
pub fn atomic_write(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| std::path::Path::new(""));
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    
    // 他の保存処理と被らないようにタイムスタンプ付きの一時ファイル名を生成
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    let tmp_path = dir.join(format!(".~tmp_{}_{}", timestamp, file_name));

    // 1. 一時ファイルに書き込み
    let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
    if let Err(e) = file.write_all(content) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }
    
    // 2. OSのバッファを強制的にストレージへ書き込む
    if let Err(e) = file.sync_all() {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }

    // 3. 一時ファイルを本来のファイル名へリネーム（OSレベルで安全に上書き）
    if let Err(e) = fs::rename(&tmp_path, path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let path = app_data_dir.join("workspaces.json");
    let json = serde_json::to_string(&workspaces).map_err(|e| e.to_string())?;
    
    // アトミック書き込みを使用
    atomic_write(&path, json.as_bytes())
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), String> {
    // アトミック書き込みを使用
    atomic_write(std::path::Path::new(&path), content.as_bytes())
}


// --- テストコード ---
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_atomic_write() {
        // OSの一時ディレクトリを利用
        let temp_dir = std::env::temp_dir();
        let target_file = temp_dir.join("obcowa_test_file.md");

        let content = b"Test Content! Hello Rust.";
        
        let result = atomic_write(&target_file, content);
        assert!(result.is_ok(), "アトミック書き込みに失敗しました");

        let saved_content = fs::read(&target_file).expect("ファイルが読み込めません");
        assert_eq!(saved_content, content, "保存された内容が一致しません");

        let _ = fs::remove_file(&target_file);
    }
}