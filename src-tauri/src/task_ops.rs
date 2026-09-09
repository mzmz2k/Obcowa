// 責務: ワークスペース内のタスク検索と、タスク状態の安全な更新処理
use serde::{Deserialize, Serialize};
use std::fs::{self, File, metadata};
use std::io::{self, BufRead, Write};
use std::path::{Path};


#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub file_path: String,
    pub line_number: usize,
    pub text: String,
    pub original_text: String,
    pub headings: Vec<String>,
    pub indent_level: usize,
    pub file_created: u64,
    pub file_modified: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub exclude_paths: Option<Vec<String>>,
    pub include_paths: Option<Vec<String>>,
}

// 拡張子判定
fn should_scan_file(path: &Path, options: &ScanOptions) -> bool {
    // 💥 除外パスのチェックを追加
    if let Some(excludes) = &options.exclude_paths {
        let path_str = path.to_string_lossy().to_string();
        if excludes.contains(&path_str) {
            return false;
        }
    }

    if let Some(ext) = path.extension() {
        if ext == "md" || ext == "txt" {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn get_workspace_tasks(
    file_paths: Vec<String>,
    options: Option<ScanOptions>
) -> Result<Vec<Task>, String> {
    let mut tasks = Vec::new();
    let opts = options.unwrap_or_default();

    // 集めたファイル群から未完了タスクを探す
    for file_path in file_paths {
        let path = Path::new(&file_path);
        if should_scan_file(path, &opts) {
            let _ = extract_tasks_from_file(path, &mut tasks);
        }
    }

    Ok(tasks)
}


fn extract_tasks_from_file(file_path: &Path, tasks: &mut Vec<Task>) -> io::Result<()> {
         // ファイルの更新日・作成日を取得（OSによって作成日が取れない場合は更新日でフォールバック）
    let meta = metadata(file_path)?;
    let file_modified = meta.modified()
        .ok() // Result を Option に変換してエラーの型を無くす
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let file_created = meta.created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(file_modified);

    let file = File::open(file_path)?;
    // readerがここで定義されます
    let reader = io::BufReader::new(file);

    // 見出し階層を保持するためのスタック
    let mut current_headings: Vec<String> = Vec::new();

    for (index, line_result) in reader.lines().enumerate() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        let trimmed = line.trim_start();

        // 先頭のインデント（空白文字数）を計算
        let indent_level = line.len() - trimmed.len();

        // 見出し行の判定とスタックの更新
        if trimmed.starts_with('#') {
            let hash_count = trimmed.chars().take_while(|&c| c == '#').count();
            // H1〜H6のフォーマットとして正しいか（#の後にスペースがあるか）
            if hash_count > 0 && hash_count <= 6 && trimmed[hash_count..].starts_with(' ') {
                let heading_text = trimmed[hash_count..].trim().to_string();
                let target_index = hash_count - 1;
                
                // 見出しレベルに合わせてスタックを調整（深い階層を切り捨てる）
                if current_headings.len() > target_index {
                    current_headings.truncate(target_index);
                }
                // 階層が飛んだ場合（H1がないのにH2が来た等）は空文字で埋める
                while current_headings.len() < target_index {
                    current_headings.push(String::new());
                }
                current_headings.push(heading_text);
                continue; // 見出し行はタスクではないので次の行へ
            }
        }

        if trimmed.starts_with("- [ ] ") {
            let text_content = trimmed.trim_start_matches("- [ ] ").to_string();
            tasks.push(Task {
                file_path: file_path.to_string_lossy().to_string(),
                line_number: index,
                text: text_content,
                original_text: line.clone(),
                headings: current_headings.clone(), // ここで headings を確実に付与
                indent_level,
                file_created,
                file_modified,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn complete_task(
    file_path: String, 
    line_number: usize, 
    original_text: String,
    completed: Option<bool>,
) -> Result<(), String> {
    let is_completed = completed.unwrap_or(true);
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = io::BufReader::new(file);
    let mut lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();

    if line_number >= lines.len() {
        return Err("Line number out of bounds. File might have been modified.".to_string());
    }

    let line = &lines[line_number];
    let trimmed = line.trim_start();
    let orig_trimmed = original_text.trim_start();

    // タスク文言の一致チェック（チェックボックスのプレフィックスを除去して比較）
    let current_content = if trimmed.starts_with("- [ ] ") {
        trimmed.trim_start_matches("- [ ] ")
    } else if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
        &trimmed[6..]
    } else {
        return Err("Target line is not a task checkbox.".to_string());
    };

    let orig_content = if orig_trimmed.starts_with("- [ ] ") {
        orig_trimmed.trim_start_matches("- [ ] ")
    } else if orig_trimmed.starts_with("- [x] ") || orig_trimmed.starts_with("- [X] ") {
        &orig_trimmed[6..]
    } else {
        orig_trimmed
    };

    if current_content != orig_content {
        return Err("The file has been modified externally. Please refresh the task list.".to_string());
    }

    // 状態に応じて置換
    if is_completed {
        lines[line_number] = lines[line_number].replacen("- [ ] ", "- [x] ", 1);
    } else {
        if lines[line_number].contains("- [x] ") {
            lines[line_number] = lines[line_number].replacen("- [x] ", "- [ ] ", 1);
        } else if lines[line_number].contains("- [X] ") {
            lines[line_number] = lines[line_number].replacen("- [X] ", "- [ ] ", 1);
        }
    }

    // アトミック書き込み: 一時ファイルに書き込んでからリネーム
    let parent = path.parent().unwrap_or(Path::new(""));
    let temp_file_path = parent.join(format!(".{}.tmp", path.file_name().unwrap().to_string_lossy()));

    {
        let mut temp_file = File::create(&temp_file_path).map_err(|e| e.to_string())?;
        for line in lines {
            writeln!(temp_file, "{}", line).map_err(|e| e.to_string())?;
        }
    }

    fs::rename(&temp_file_path, path).map_err(|e| {
        // リネーム失敗時は一時ファイルを削除してクリーンアップ
        let _ = fs::remove_file(&temp_file_path);
        e.to_string()
    })?;

    Ok(())
}