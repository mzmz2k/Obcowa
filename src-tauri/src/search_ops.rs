// 画面上の仮想ツリー（VirtualNode）を対象とした高速ファイル検索コマンドおよび関連処理

use std::fs;
use serde::Serialize;
use crate::models::VirtualNode;

// 検索結果用の構造体
#[derive(Debug, Serialize, Clone)]
pub struct SearchResultItem {
    pub path: String,
    pub name: String,
    pub snippet: String,
}

/// VirtualNode ツリーから実在するファイル（名前, パス）を再帰的に抽出する共通関数
pub fn extract_files_from_nodes(nodes: &[VirtualNode]) -> Vec<(String, String)> {
    fn collect(nodes: &[VirtualNode], files: &mut Vec<(String, String)>) {
        for node in nodes {
            match node {
                VirtualNode::Folder { children, .. } => collect(children, files),
                VirtualNode::File { name, path, .. } => files.push((name.clone(), path.clone())),
            }
        }
    }
    let mut files = Vec::new();
    collect(nodes, &mut files);
    files.sort_by(|a, b| a.1.cmp(&b.1));
    files.dedup_by(|a, b| a.1 == b.1);
    files
}

// バックエンドでの高速な検索処理
#[tauri::command]
pub async fn search_files(
    nodes: Vec<VirtualNode>,
    search_by_filename: bool, 
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let files = extract_files_from_nodes(&nodes);
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for (name, path) in files {
        if search_by_filename {
            if name.to_lowercase().contains(&query_lower) {
                results.push(SearchResultItem {
                    path,
                    name,
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
                            name,
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