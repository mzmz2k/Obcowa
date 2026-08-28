// アプリケーション全体で使用する共通データモデル（Workspace, VirtualNode など）の定義

use serde::{Deserialize, Serialize};

fn default_font() -> String { "sans-serif".to_string() }
fn default_sort_by() -> String { "name".to_string() }
fn default_sort_order() -> String { "asc".to_string() }
fn default_match_mode() -> String { "contains".to_string() }

// ピン留め用の構造体
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

// タブ情報用の構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedTab {
    pub id: String,
    pub path: String,
    pub title: String,
    #[serde(rename = "isEditing")]
    pub is_editing: bool,
}

// スマートフォルダの条件
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "cond_type")]
pub enum SmartCondition {
    Tag {
        tag: String,
        #[serde(default = "default_match_mode")]
        match_mode: String,
        include_inline: bool,
        is_exclude: bool,
    },
    Date {
        date_type: String, 
        limit: usize,
    }
}

// スマートフォルダのルール構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmartRules {
    pub target_dir: String,
    #[serde(default)]
    pub target_workspace: bool,
    pub match_type: String,
    pub conditions: Vec<SmartCondition>,
    pub keep_structure: bool,
}

// 仮想ツリーのノード定義
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum VirtualNode {
    Folder {
        name: String,
        original_path: Option<String>,
        children: Vec<VirtualNode>,
        #[serde(default)]
        smart_rules: Option<SmartRules>,
        #[serde(default)]
        sort_by: Option<String>,
        #[serde(default)]
        sort_order: Option<String>,
    },
    File {
        name: String,
        path: String,
        #[serde(default)]
        created: u64,
        #[serde(default)]
        modified: u64,
    },
}

// ワークスペース全体の構造体
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