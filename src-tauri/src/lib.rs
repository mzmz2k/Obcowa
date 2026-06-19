// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager}; 

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub category: String,
    pub nodes: Vec<VirtualNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum VirtualNode {
    Folder {
        name: String,
        original_path: Option<String>,
        children: Vec<VirtualNode>,
    },
    File {
        name: String,
        path: String,
    },
}

#[tauri::command]
async fn extract_files_by_tag(
    dir_path: String,
    target_tag: String,
    include_inline: bool,
) -> Result<Vec<String>, String> {
    let mut matched_files = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(content) = fs::read_to_string(&path) {
                let is_match = if include_inline {
                    content.contains(&format!("#{}", target_tag))
                        || check_frontmatter(&content, &target_tag)
                } else {
                    check_frontmatter(&content, &target_tag)
                };

                if is_match {
                    matched_files.push(path.to_string_lossy().into_owned());
                }
            }
        }
    }
    Ok(matched_files)
}

fn check_frontmatter(content: &str, tag: &str) -> bool {
    if content.starts_with("---\n") {
        if let Some(end_idx) = content[4..].find("---\n") {
            let frontmatter = &content[4..4 + end_idx];
            return frontmatter.contains(tag);
        }
    }
    false
}

#[tauri::command]
fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String> {
    // OS標準のアプリデータ保存場所を取得
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    
    let path = app_data_dir.join("workspaces.json");
    let json = serde_json::to_string(&workspaces).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_data_dir.join("workspaces.json");
    
    if !path.exists() {
        return Ok(Vec::new()); // なければ空のリストを返す
    }
    
    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let workspaces: Vec<Workspace> = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(workspaces)
}


#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<VirtualNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();

        if path.is_dir() {
            nodes.push(VirtualNode::Folder {
                name,
                original_path: Some(path.to_string_lossy().into_owned()),
                children: Vec::new(), // 最初は閉じているので空にしておく
            });
        } else if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            // 今回はMarkdown(.md)のみをリストアップ
            nodes.push(VirtualNode::File {
                name,
                path: path.to_string_lossy().into_owned(),
            });
        }
    }
    
    // フォルダが上に、ファイルが下にくるようにソート
    nodes.sort_by(|a, b| {
        let is_dir_a = matches!(a, VirtualNode::Folder { .. });
        let is_dir_b = matches!(b, VirtualNode::Folder { .. });
        is_dir_b.cmp(&is_dir_a) // true (dir) が先
    });

    Ok(nodes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            extract_files_by_tag,
            save_workspaces,
            load_workspaces,
            read_file_content,
            read_directory      
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}