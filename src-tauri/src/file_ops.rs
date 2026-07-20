use std::fs;
use std::io::Write;
use tauri::{AppHandle, Manager};
// lib.rs で定義されている構造体を使えるように読み込む
use crate::{Workspace, VirtualNode};

/// 💥 安全にファイルを保存するアトミック書き込み関数
pub fn atomic_write(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| std::path::Path::new(""));
    let file_name = path.file_name().unwrap_or_default().to_string_lossy();
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    let tmp_path = dir.join(format!(".~tmp_{}_{}", timestamp, file_name));

    let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
    if let Err(e) = file.write_all(content) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }
    
    if let Err(e) = file.sync_all() {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }

    if let Err(e) = fs::rename(&tmp_path, path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.to_string());
    }

    Ok(())
}

// ============================================
// ファイル・ディレクトリ操作系コマンド
// ============================================

#[tauri::command]
pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

    let path = app_data_dir.join("workspaces.json");
    let json = serde_json::to_string(&workspaces).map_err(|e| e.to_string())?;
    
    atomic_write(&path, json.as_bytes())
}

#[tauri::command]
pub fn load_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_data_dir.join("workspaces.json");

    if !path.exists() {
        return Ok(Vec::new()); 
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let workspaces: Vec<Workspace> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(workspaces)
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), String> {
    atomic_write(std::path::Path::new(&path), content.as_bytes())
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<VirtualNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();

        if path.is_dir() {
            nodes.push(VirtualNode::Folder {
                name,
                original_path: Some(path.to_string_lossy().into_owned()),
                children: Vec::new(), 
                smart_rules: None, 
                sort_by: None,    
                sort_order: None, 
            });
        } else if path.is_file() && (path.extension().and_then(|s| s.to_str()) == Some("md") || path.extension().and_then(|s| s.to_str()) == Some("txt")) {
            let metadata = entry.metadata().unwrap();
            let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH).duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let created = metadata.created().unwrap_or(metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)).duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            nodes.push(VirtualNode::File {
                name,
                path: path.to_string_lossy().into_owned(),
                created,  
                modified, 
            });
        }
    }

    nodes.sort_by(|a, b| {
        let is_dir_a = matches!(a, VirtualNode::Folder { .. });
        let is_dir_b = matches!(b, VirtualNode::Folder { .. });
        is_dir_b.cmp(&is_dir_a) 
    });

    Ok(nodes)
}

#[tauri::command]
pub fn create_new_file(dir_path: String, file_name: String, insert_tag: String) -> Result<(), String> {
    let path = std::path::Path::new(&dir_path).join(&file_name);
    if path.exists() {
        return Err("同じ名前のファイルがすでに存在します".into());
    }
    
    let mut content = String::new();
    if !insert_tag.trim().is_empty() {
        content = format!("---\ntags:\n  - {}\n---\n\n", insert_tag.trim());
    }

    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn find_image_file(dir_path: String, file_name: String) -> Result<Option<String>, String> {
    if dir_path.trim().is_empty() {
        return Ok(None);
    }
    
    fn find_recursive(dir: &std::path::Path, target: &str) -> Option<String> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(found) = find_recursive(&path, target) {
                        return Some(found);
                    }
                } else if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name == target {
                            return Some(path.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }
        None
    }

    Ok(find_recursive(std::path::Path::new(&dir_path), &file_name))
}

#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

// --- テストコード ---
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atomic_write() {
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