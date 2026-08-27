// 責務: ワークスペース内のタスク検索と、タスク状態の安全な更新処理
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use crate::{file_ops, VirtualNode};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub file_path: String,
    pub line_number: usize,
    pub text: String,
    pub original_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ScanOptions {
    pub exclude_paths: Option<Vec<String>>,
    pub include_paths: Option<Vec<String>>,
}

// 拡張子判定
fn should_scan_file(path: &Path, _options: &ScanOptions) -> bool {
    if let Some(ext) = path.extension() {
        if ext == "md" || ext == "txt" {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn get_workspace_tasks(
    app: AppHandle,
    workspace_index: usize, // 💥 フロントからはインデックスだけ受け取るように戻す
    options: Option<ScanOptions>
) -> Result<Vec<Task>, String> {
    let mut tasks = Vec::new();
    let opts = options.unwrap_or_default();

    // 💥 検索機能と全く同じ方法でワークスペース情報を読み込む
    let workspaces = file_ops::load_workspaces(app).map_err(|e| e.to_string())?;
    if workspace_index >= workspaces.len() {
        return Err("無効なワークスペースです".to_string());
    }
    let ws = &workspaces[workspace_index];
    let mut dirs = Vec::new();

    // 💥 検索機能から流用：ツリーから original_path をかき集める
    fn extract_dirs(nodes: &[VirtualNode], dirs: &mut Vec<String>) {
        for node in nodes {
            if let VirtualNode::Folder { original_path: Some(path), children, .. } = node {
                dirs.push(path.clone());
                extract_dirs(children, dirs);
            }
        }
    }

    extract_dirs(&ws.nodes, &mut dirs);

    // 重複を削除
    dirs.sort();
    dirs.dedup();

    let mut all_files = Vec::new();
    
    // ディレクトリの中身を再帰的に集める
    for dir in dirs {
        collect_files_from_dir(Path::new(&dir), &mut all_files);
    }

    all_files.sort();
    all_files.dedup();

    // 集めたファイル群から未完了タスクを探す
    for file_path in all_files {
        let path = Path::new(&file_path);
        if should_scan_file(path, &opts) {
            let _ = extract_tasks_from_file(path, &mut tasks);
        }
    }

    Ok(tasks)
}

fn collect_files_from_dir(dir: &Path, files: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files_from_dir(&path, files);
            } else if path.is_file() {
                files.push(path.to_string_lossy().into_owned());
            }
        }
    }
}

fn extract_tasks_from_file(file_path: &Path, tasks: &mut Vec<Task>) -> io::Result<()> {
    let file = File::open(file_path)?;
    let reader = io::BufReader::new(file);

    for (index, line_result) in reader.lines().enumerate() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

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