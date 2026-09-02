// 画面上の仮想ツリー（VirtualNode）を対象とした高速ファイル検索コマンドおよび関連処理

use std::fs;
use std::path::Path;
use serde::Serialize;

// 検索結果用の構造体
#[derive(Debug, Serialize, Clone)]
pub struct SearchResultItem {
    pub path: String,
    pub name: String,
    pub snippet: String,
}

// バックエンドでの高速な検索処理
#[tauri::command]
pub async fn search_files(
    file_paths: Vec<String>,
    search_by_filename: bool, 
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for path in file_paths {
        let file_name = Path::new(&path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if search_by_filename {
            if file_name.to_lowercase().contains(&query_lower) {
                results.push(SearchResultItem {
                    path,
                    name: file_name,
                    snippet: "(ファイル名に一致)".to_string(),
                });
            }
        } else {
            // 必要なファイルのみ本文を読み込む
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines() {
                    if line.to_lowercase().contains(&query_lower) {
                        let trimmed = line.trim();
                        let snippet = if trimmed.chars().count() > 100 {
                            format!("{}...", trimmed.chars().take(100).collect::<String>())
                        } else {
                            trimmed.to_string()
                        };

                        results.push(SearchResultItem {
                            path,
                            name: file_name,
                            snippet,
                        });
                        break;
                    }
                }
            }
        }
    }
    Ok(results)
}