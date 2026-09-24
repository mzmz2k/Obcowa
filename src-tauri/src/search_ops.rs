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
    pub created_at: u64,
    pub updated_at: u64,
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
        // メタデータから作成日・更新日を安全に取得 (取得不能なら0)
        let metadata = fs::metadata(&path).ok();
        let created_at = metadata.as_ref().and_then(|m| m.created().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
        let updated_at = metadata.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);

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
                    created_at,
                    updated_at,
                });
            }
        } else {
            // 必要なファイルのみ本文を読み込む
            if let Ok(content) = fs::read_to_string(&path) {
                let mut in_frontmatter = false;
                let is_tag_query = query_lower.starts_with('#');
                let query_no_hash = if is_tag_query { &query_lower[1..] } else { &query_lower };

                for (i, line) in content.lines().enumerate() {
                    let line_lower = line.to_lowercase();

                    // フロントマター領域の判定 (ファイルの先頭が --- で始まり、次の --- まで)
                    if i == 0 && line.trim() == "---" {
                        in_frontmatter = true;
                    } else if in_frontmatter && i > 0 && line.trim() == "---" {
                        in_frontmatter = false;
                    }

                    // 通常の部分一致、またはフロントマター内のハッシュ無しタグ一致
                    let matched = if line_lower.contains(&query_lower) {
                        true
                    } else {
                        is_tag_query && in_frontmatter && line_lower.contains(query_no_hash)
                    };

                    if matched {
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
                            created_at,
                            updated_at,
                        });
                        break;
                    }
                }
            }
        }
    }
    Ok(results)
}