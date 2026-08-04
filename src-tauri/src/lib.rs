// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// モジュールを登録
mod file_ops;

use serde::{Deserialize, Serialize};
use std::fs;

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

fn default_font() -> String { "sans-serif".to_string() }
fn default_sort_by() -> String { "name".to_string() }
fn default_sort_order() -> String { "asc".to_string() }

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

    #[serde(default)]
    pub saved_tabs: Vec<SavedTab>,
    #[serde(default)]
    pub active_tab_id: Option<String>,
    #[serde(default = "default_font")]
    pub editor_font: String,

    #[serde(default = "default_sort_by")]
    pub sort_by: String,
    #[serde(default = "default_sort_order")]
    pub sort_order: String,
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
    #[serde(default)]
    pub target_workspace: bool, // これを追加
    pub match_type: String,
    pub conditions: Vec<SmartCondition>,
    pub keep_structure: bool,
}

// 💥 追加: 検索結果用の構造体
#[derive(Debug, Serialize, Clone)]
pub struct SearchResultItem {
    pub path: String,
    pub name: String,
    pub snippet: String,
}

// 💥 追加: バックエンドでの高速な検索処理
#[tauri::command]
async fn search_files(
    app: tauri::AppHandle,
    workspace_index: usize,
    include_library: bool,
    search_by_filename: bool, 
    query: String,
) -> Result<Vec<SearchResultItem>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // 最新のワークスペース情報を取得して対象フォルダを抽出
    let workspaces = crate::file_ops::load_workspaces(app.clone())?;
    
    if workspace_index >= workspaces.len() {
        return Err("無効なワークスペースです".into());
    }

    let ws = &workspaces[workspace_index];
    let mut dirs = Vec::new();

    // フォルダツリーから original_path を再帰的にかき集める関数
    fn extract_dirs(nodes: &[VirtualNode], dirs: &mut Vec<String>) {
        for node in nodes {
            if let VirtualNode::Folder { original_path: Some(path), children, .. } = node {
                dirs.push(path.clone());
                extract_dirs(children, dirs);
            }
        }
    }

    extract_dirs(&ws.nodes, &mut dirs);

    // ライブラリを含める場合
    if include_library {
        for lib_id in &ws.linked_libraries {
            if let Some(lib) = workspaces.iter().find(|w| &w.id == lib_id) {
                extract_dirs(&lib.nodes, &mut dirs);
            }
        }
    }

    // 重複を削除（同じフォルダを何度も検索しないため）
    dirs.sort();
    dirs.dedup();

    let mut all_files = Vec::new();
    for dir in dirs {
        collect_files(std::path::Path::new(&dir), &mut all_files);
    }

    // ファイルの重複を削除（別リストで同じファイルを参照している場合）
    all_files.sort_by(|a, b| a.path.cmp(&b.path));
    all_files.dedup_by(|a, b| a.path == b.path);

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    // 全ファイルを走査
    for file in all_files {
        if search_by_filename {
            // 💥 追加: ファイル名のみを検索対象とする場合
            if file.name.to_lowercase().contains(&query_lower) {
                results.push(SearchResultItem {
                    path: file.path.clone(),
                    name: file.name.clone(),
                    snippet: "(ファイル名に一致)".to_string(), // 中身のスニペットはないため固定メッセージ
                });
            }
        } else {
            // 💥 既存: 本文を検索対象とする場合
            for line in file.content.lines() {
                if line.to_lowercase().contains(&query_lower) {
                    let trimmed = line.trim();
                    let snippet = if trimmed.chars().count() > 100 {
                        format!("{}...", trimmed.chars().take(100).collect::<String>())
                    } else {
                        trimmed.to_string()
                    };

                    results.push(SearchResultItem {
                        path: file.path.clone(),
                        name: file.name.clone(),
                        snippet,
                    });
                    break; // 1ファイルにつき1箇所の表示で十分なため次のファイルへ
                }
            }
        }
    }
    Ok(results)
}


// 💥 デフォルト値用の関数を用意
fn default_match_mode() -> String { "contains".to_string() }

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "cond_type")]
pub enum SmartCondition {
    Tag {
        tag: String,
        #[serde(default = "default_match_mode")] // 過去データ互換用
        match_mode: String,
        include_inline: bool,
        is_exclude: bool,
    },
    Date {
        date_type: String, 
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
        // 💥 追加: 個別フォルダごとのソート設定
        #[serde(default)]
        sort_by: Option<String>,
        #[serde(default)]
        sort_order: Option<String>,
    },
    File {
        name: String,
        path: String,
        // 💥 追加: ファイルのメタデータ（UNIXタイムスタンプ）
        #[serde(default)]
        created: u64,
        #[serde(default)]
        modified: u64,
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
    // 💥 追加: created と modified を追加
    struct TempNode { is_file: bool, name: String, path: String, created: u64, modified: u64, children: HashMap<String, TempNode> }

    let mut root = TempNode { is_file: false, name: "".into(), path: base_dir.into(), created: 0, modified: 0, children: HashMap::new() };
    let base_path = std::path::Path::new(base_dir);

    for file in files {
        if let Ok(rel_path) = std::path::Path::new(&file.path).strip_prefix(base_path) {
            let components: Vec<_> = rel_path.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
            let mut current = &mut root;
            let mut current_path = base_path.to_path_buf();

            // 💥 追加: 日付をミリ秒(u64)に変換
            let c_ms = file.created.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let m_ms = file.modified.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            for (i, comp) in components.iter().enumerate() {
                current_path.push(comp);
                if i == components.len() - 1 {
                    current.children.insert(comp.clone(), TempNode { is_file: true, name: comp.clone(), path: file.path.clone(), created: c_ms, modified: m_ms, children: HashMap::new() });
                } else {
                    let cp = current_path.to_string_lossy().into_owned();
                    current = current.children.entry(comp.clone()).or_insert_with(|| TempNode { is_file: false, name: comp.clone(), path: cp, created: 0, modified: 0, children: HashMap::new() });
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
                // 💥 変更: created と modified を渡す
                nodes.push(VirtualNode::File { name: val.name, path: val.path, created: val.created, modified: val.modified }); 
            } else { 
                let name_clone = val.name.clone();
                let path_clone = val.path.clone();
                nodes.push(VirtualNode::Folder { 
                    name: name_clone, 
                    original_path: Some(path_clone), 
                    children: convert(val), 
                    smart_rules: None,
                    sort_by: None,    // 💥 追加
                    sort_order: None  // 💥 追加
                }); 
            }
        }
        nodes
    }
    convert(root)
}

// 💥 追加: スマートフォルダの条件評価コマンド
#[tauri::command]
async fn evaluate_smart_folder(
    rules: SmartRules, 
    workspace_nodes: Option<Vec<VirtualNode>> // 💥 フロントの最新ツリーを受け取る
) -> Result<Vec<VirtualNode>, String> {
    
    let mut all_files = Vec::new();

    // 1. 抽出元フォルダが指定されている場合
    if !rules.target_dir.trim().is_empty() {
        collect_files(std::path::Path::new(&rules.target_dir), &mut all_files);
    }

    // 2. ワークスペースが抽出対象にチェックされている場合
    if rules.target_workspace {
        if let Some(nodes) = workspace_nodes {
            
            // 💥 変更: OSの物理フォルダを読み直すのではなく、ツリー上に見えているファイルだけを純粋にかき集める
            fn traverse(nodes: &[VirtualNode], files: &mut Vec<FileMeta>) {
                for node in nodes {
                    match node {
                        VirtualNode::Folder { children, .. } => {
                            traverse(children, files);
                        },
                        VirtualNode::File { path, .. } => {
                            if let Some(meta) = get_file_meta_from_path(std::path::Path::new(path)) {
                                files.push(meta);
                            }
                        }
                    }
                }
            }
            
            traverse(&nodes, &mut all_files);
        }
    }

    // 💥 追加: 指定フォルダとワークスペースの範囲が被っていた場合、ファイルの重複を排除する
    all_files.sort_by(|a, b| a.path.cmp(&b.path));
    all_files.dedup_by(|a, b| a.path == b.path);

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
                SmartCondition::Tag { tag, match_mode, include_inline, is_exclude } => {
                    let has_tag = check_tag_match(&file.content, tag, match_mode, *include_inline);
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

    if rules.keep_structure { 
        // 対象のベースディレクトリを仮決めする（フォルダ指定があればそれ、なければ空）
        let base = if !rules.target_dir.is_empty() { &rules.target_dir } else { "" };
        Ok(build_tree_from_paths(filtered_files, base)) 
    } else { 
        Ok(filtered_files.into_iter().map(|f| {
            let c_ms = f.created.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            let m_ms = f.modified.duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
            VirtualNode::File { name: f.name, path: f.path, created: c_ms, modified: m_ms }
        }).collect()) 
    }
}

// 💥 追加: 単体のファイルパスからデータを構築する関数
fn get_file_meta_from_path(path: &std::path::Path) -> Option<FileMeta> {
    if path.is_file() {
        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ext == "md" || ext == "txt" {
                if let Ok(metadata) = std::fs::metadata(path) {
                    let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                    let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                    let created = metadata.created().unwrap_or(modified);
                    let content = std::fs::read_to_string(path).unwrap_or_default();
                    return Some(FileMeta {
                        path: path.to_string_lossy().into_owned(),
                        name, created, modified, content,
                    });
                }
            }
        }
    }
    None
}

// 💥 追加: タグを正確に抽出し、指定された条件で比較する関数
fn check_tag_match(content: &str, target_tag: &str, match_mode: &str, include_inline: bool) -> bool {
    let target = target_tag.trim();
    if target.is_empty() {
        return false; // 空文字の場合はマッチさせない（全件ヒットバグの防止）
    }

    let mut candidate_tags = Vec::new();

    // 1. フロントマター内から「単語」だけを抽出する
    if content.starts_with("---\n") {
        if let Some(end_idx) = content[4..].find("---\n") {
            let frontmatter = &content[4..4 + end_idx];
            let delimiters = [' ', '\n', '\t', ',', '[', ']', '"', '\'', '-'];
            for word in frontmatter.split(|c: char| delimiters.contains(&c)) {
                let w = word.trim();
                if !w.is_empty() && w != "tags:" && w != "tag:" {
                    candidate_tags.push(w);
                }
            }
        }
    }

    // 2. 本文中から "#" で始まる単語を抽出する
    if include_inline {
        let delimiters = [' ', '\n', '\t', ',', '.', '!', '?', '(', ')', '[', ']', '<', '>'];
        for word in content.split(|c: char| delimiters.contains(&c)) {
            if word.starts_with('#') && word.len() > 1 {
                candidate_tags.push(&word[1..]); // 先頭の # を除いて格納
            }
        }
    }

    // 3. 抽出したタグの中に条件を満たすものがあるかチェック
    for tag in candidate_tags {
        let is_match = match match_mode {
            "exact" => tag == target,
            "starts" => tag.starts_with(target),
            "ends" => tag.ends_with(target),
            "contains" => tag.contains(target),
            _ => tag.contains(target),
        };
        if is_match {
            return true;
        }
    }
    false
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
            evaluate_smart_folder,
            search_files,

            file_ops::save_workspaces,
            file_ops::load_workspaces,
            file_ops::get_file_modified,
            file_ops::read_file_content,
            file_ops::read_directory,
            file_ops::save_file_content,
            file_ops::create_new_file,
            file_ops::open_folder,
            file_ops::find_image_file,
            file_ops::check_file_exists 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

