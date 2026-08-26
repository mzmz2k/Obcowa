// 責務: ワークスペース内のタスク検索と、タスク状態の安全な更新処理

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub file_path: String,
    pub line_number: usize,
    pub text: String,
    pub original_text: String,
}

// 将来のフィルタリング設定用インターフェース
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ScanOptions {
    pub exclude_paths: Option<Vec<String>>,
    pub include_paths: Option<Vec<String>>,
}

// フィルタリング判定（将来拡張用）
fn should_scan_file(path: &Path, _options: &ScanOptions) -> bool {
    // 拡張子が.mdまたは.txtのものだけを対象とする
    if let Some(ext) = path.extension() {
        if ext == "md" || ext == "txt" {
            // TODO: ここに将来 exclude_paths や include_paths の判定ロジックを追加する
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn get_workspace_tasks(workspace_path: String, options: Option<ScanOptions>) -> Result<Vec<Task>, String> {
    let mut tasks = Vec::new();
    let opts = options.unwrap_or_default();
    let root_path = Path::new(&workspace_path);

    if !root_path.exists() || !root_path.is_dir() {
        return Err("Invalid workspace path".to_string());
    }

    scan_dir(root_path, &opts, &mut tasks).map_err(|e| e.to_string())?;
    Ok(tasks)
}

fn scan_dir(dir: &Path, options: &ScanOptions, tasks: &mut Vec<Task>) -> io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // TODO: フォルダの除外設定がある場合はここで判定
                scan_dir(&path, options, tasks)?;
            } else if should_scan_file(&path, options) {
                extract_tasks_from_file(&path, tasks)?;
            }
        }
    }
    Ok(())
}

fn extract_tasks_from_file(file_path: &Path, tasks: &mut Vec<Task>) -> io::Result<()> {
    let file = File::open(file_path)?;
    let reader = io::BufReader::new(file);

    for (index, line_result) in reader.lines().enumerate() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue, // バイナリなど読み取れない行はスキップ
        };

        // 未完了タスク "- [ ] " のみ抽出 (先頭の空白も許容)
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [ ] ") {
            let text_content = trimmed.trim_start_matches("- [ ] ").to_string();
            tasks.push(Task {
                file_path: file_path.to_string_lossy().to_string(),
                line_number: index,
                text: text_content,
                original_text: line.clone(),
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn complete_task(file_path: String, line_number: usize, original_text: String) -> Result<(), String> {
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

    // 楽観的ロック：行の内容が取得時と一致するか確認
    if lines[line_number] != original_text {
        return Err("The file has been modified externally. Please refresh the task list.".to_string());
    }

    // 未完了を完了に置き換え（最初に見つかった "- [ ] " のみ置換してインデントを崩さない）
    lines[line_number] = lines[line_number].replacen("- [ ] ", "- [x] ", 1);

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