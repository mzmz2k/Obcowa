// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

// 💥 ピン留め用の構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PinnedItem {
    pub item_type: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LinkItem {
    pub id: String,
    pub title: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub category: String,
    pub nodes: Vec<VirtualNode>,
    #[serde(default)]
    pub links: Vec<LinkItem>,
    #[serde(default)]
    pub pinned: Vec<PinnedItem>,
    
    #[serde(default)]
    pub linked_libraries: Vec<String>,
    #[serde(default)]
    pub is_flat: bool,
    #[serde(default)]
    pub open_in_new_tab: bool,

    // 💥 追加: タブ復元用データ
    #[serde(default)]
    pub saved_tabs: Vec<SavedTab>,
    #[serde(default)]
    pub active_tab_id: Option<String>,
}

// 💥 追加: タブ情報用の構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedTab {
    pub id: String,
    pub path: String,
    pub title: String,
    #[serde(rename = "isEditing")] // JSのキャメルケースと合わせる
    pub is_editing: bool,
}

// 💥 追加: スマートフォルダのルール構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmartRules {
    pub target_dir: String,
    pub match_type: String, // "AND" または "OR"
    pub conditions: Vec<SmartCondition>,
    pub keep_structure: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "cond_type")]
pub enum SmartCondition {
    Tag {
        tag: String,
        include_inline: bool,
        is_exclude: bool,
    },
    Date {
        date_type: String, // "created" または "updated"
        limit: usize,
    }
}

// 💥 変更: VirtualNode に smart_rules を追加（過去データ互換のため default を指定）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum VirtualNode {
    Folder {
        name: String,
        original_path: Option<String>,
        children: Vec<VirtualNode>,
        #[serde(default)]
        smart_rules: Option<SmartRules>,
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
fn read_file_content(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<VirtualNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();

        if path.is_dir() {
            nodes.push(VirtualNode::Folder {
                name,
                original_path: Some(path.to_string_lossy().into_owned()),
                children: Vec::new(), 
                smart_rules: None, // 💥 これを追加
            });
        // 💥 md と txt の両方を許可する
        } else if path.is_file() && (path.extension().and_then(|s| s.to_str()) == Some("md") || path.extension().and_then(|s| s.to_str()) == Some("txt")) {
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

#[tauri::command]
fn save_file_content(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_new_file(dir_path: String, file_name: String) -> Result<(), String> {
    let path = std::path::Path::new(&dir_path).join(&file_name);
    if path.exists() {
        return Err("同じ名前のファイルがすでに存在します".into());
    }
    std::fs::write(path, "").map_err(|e| e.to_string())?;
    Ok(())
}

// 💥 追加：OSの標準機能を使って直接フォルダを開く
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
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

// 💥 追加: ファイルのメタ情報を扱う構造体
#[derive(Debug, Clone)]
struct FileMeta {
    path: String,
    name: String,
    created: std::time::SystemTime,
    modified: std::time::SystemTime,
    content: String,
}

// 💥 追加: フォルダを再帰的に走査して FileMeta を集める関数
fn collect_files(dir: &std::path::Path, metas: &mut Vec<FileMeta>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files(&path, metas);
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if ext == "md" || ext == "txt" {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                        let metadata = entry.metadata().unwrap();
                        let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                        let created = metadata.created().unwrap_or(modified);
                        let content = fs::read_to_string(&path).unwrap_or_default();
                        
                        metas.push(FileMeta {
                            path: path.to_string_lossy().into_owned(),
                            name, created, modified, content,
                        });
                    }
                }
            }
        }
    }
}

// 💥 追加: パスのリストからツリー構造を復元する関数
fn build_tree_from_paths(files: Vec<FileMeta>, base_dir: &str) -> Vec<VirtualNode> {
    use std::collections::HashMap;
    struct TempNode { is_file: bool, name: String, path: String, children: HashMap<String, TempNode> }

    let mut root = TempNode { is_file: false, name: "".into(), path: base_dir.into(), children: HashMap::new() };
    let base_path = std::path::Path::new(base_dir);

    for file in files {
        if let Ok(rel_path) = std::path::Path::new(&file.path).strip_prefix(base_path) {
            let components: Vec<_> = rel_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
            let mut current = &mut root;
            let mut current_path = base_path.to_path_buf();

            for (i, comp) in components.iter().enumerate() {
                current_path.push(comp);
                if i == components.len() - 1 {
                    current.children.insert(comp.clone(), TempNode { is_file: true, name: comp.clone(), path: file.path.clone(), children: HashMap::new() });
                } else {
                    let cp = current_path.to_string_lossy().into_owned();
                    current = current.children.entry(comp.clone()).or_insert_with(|| TempNode { is_file: false, name: comp.clone(), path: cp, children: HashMap::new() });
                }
            }
        }
    }

    fn convert(temp: TempNode) -> Vec<VirtualNode> {
        let mut nodes = Vec::new();
        let mut vals: Vec<_> = temp.children.into_values().collect();
        vals.sort_by(|a, b| if a.is_file == b.is_file { a.name.cmp(&b.name) } else if a.is_file { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less });
        for val in vals {
            if val.is_file { 
                nodes.push(VirtualNode::File { name: val.name, path: val.path }); 
            } else { 
                // 💥 エラー回避のため、文字を一度コピーしておく
                let name_clone = val.name.clone();
                let path_clone = val.path.clone();
                nodes.push(VirtualNode::Folder { 
                    name: name_clone, 
                    original_path: Some(path_clone), 
                    children: convert(val), 
                    smart_rules: None 
                }); 
            }
        }
        nodes
    }
    convert(root)
}

// 💥 追加: スマートフォルダの条件評価コマンド
#[tauri::command]
async fn evaluate_smart_folder(rules: SmartRules) -> Result<Vec<VirtualNode>, String> {
    let mut all_files = Vec::new();
    collect_files(std::path::Path::new(&rules.target_dir), &mut all_files);

    // Date条件ごとの上位N件を抽出
    let mut date_sets: Vec<std::collections::HashSet<String>> = Vec::new();
    for cond in &rules.conditions {
        if let SmartCondition::Date { date_type, limit } = cond {
            let mut sorted = all_files.clone();
            if date_type == "created" { sorted.sort_by(|a, b| b.created.cmp(&a.created)); } 
            else { sorted.sort_by(|a, b| b.modified.cmp(&a.modified)); }
            date_sets.push(sorted.into_iter().take(*limit).map(|f| f.path).collect());
        }
    }

    let mut filtered_files = Vec::new();
    for file in all_files {
        let mut is_match_all = true;
        let mut is_match_any = false;
        let mut has_conditions = false;
        let mut date_cond_idx = 0;

        for cond in &rules.conditions {
            has_conditions = true;
            let cond_match = match cond {
                SmartCondition::Tag { tag, include_inline, is_exclude } => {
                    let has_tag = if *include_inline { file.content.contains(&format!("#{}", tag)) || check_frontmatter(&file.content, tag) } else { check_frontmatter(&file.content, tag) };
                    if *is_exclude { !has_tag } else { has_tag }
                },
                SmartCondition::Date { .. } => {
                    let is_in_top = date_sets[date_cond_idx].contains(&file.path);
                    date_cond_idx += 1;
                    is_in_top
                }
            };
            is_match_all = is_match_all && cond_match;
            is_match_any = is_match_any || cond_match;
        }

        let is_valid = if !has_conditions { true } else if rules.match_type == "AND" { is_match_all } else { is_match_any };
        if is_valid { filtered_files.push(file); }
    }

    if rules.keep_structure { Ok(build_tree_from_paths(filtered_files, &rules.target_dir)) } 
    else { Ok(filtered_files.into_iter().map(|f| VirtualNode::File { name: f.name, path: f.path }).collect()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build()) 
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            extract_files_by_tag,
            save_workspaces,
            load_workspaces,
            read_file_content,
            read_directory,
            save_file_content,
            create_new_file,
            open_folder,
            evaluate_smart_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
