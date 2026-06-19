// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::{Deserialize, Serialize};
use std::fs;

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
                    content.contains(&format!("#{}", target_tag)) || check_frontmatter(&content, &target_tag)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![extract_files_by_tag])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
