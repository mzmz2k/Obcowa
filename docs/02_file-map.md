# ディレクトリ構成と主要ファイル

```
A03_Obcowa/
├── .githooks
│   ├── _pre-push
│   └── pre-commit
├── .gitignore
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── README.md
├── myicon.png
├── package-lock.json
├── package.json
├── scripts
│   ├── generate_filemap.js
│   └── generate_filemap.test.js
├── src
│   ├── app.css
│   ├── app.html
│   ├── components
│   │   ├── Editor
│   │   │   ├── Editor.svelte
│   │   │   ├── EditorHeader.svelte
│   │   │   ├── EditorPreview.svelte
│   │   │   ├── EditorSearch.svelte
│   │   │   ├── TabBar.svelte
│   │   │   ├── markdownSetup.ts
│   │   │   ├── previewExtensions.test.ts
│   │   │   └── previewExtensions.ts
│   │   ├── Modals
│   │   │   ├── NewFileModal.svelte
│   │   │   ├── SmartFolderModal.svelte
│   │   │   └── WorkspaceManager.svelte
│   │   ├── Settings
│   │   │   ├── SettingsModal.svelte
│   │   │   ├── StyleSettings.svelte
│   │   │   ├── ThemeSettings.svelte
│   │   │   └── ThemeSettings.tst.ts
│   │   ├── Sidebar
│   │   │   ├── SidebarFooter.svelte
│   │   │   ├── SidebarHeader.svelte
│   │   │   ├── SidebarLinks.svelte
│   │   │   └── SidebarTree.svelte
│   │   └── TreeNode.svelte
│   ├── features
│   │   ├── ContextMenu.svelte
│   │   ├── Dashboard
│   │   │   ├── DashboardManager.ts
│   │   │   └── widgets
│   │   │       └── SearchWidget.svelte
│   │   ├── Task
│   │   │   ├── TaskItem.svelte
│   │   │   └── TaskList.svelte
│   │   ├── launcher
│   │   │   ├── +page.svelte
│   │   │   └── LauncherWindow.svelte
│   │   └── styleSettings
│   │       ├── styleStore.test.ts
│   │       └── styleStore.ts
│   ├── lib
│   │   ├── editor
│   │   │   ├── editorSave.test.ts
│   │   │   ├── editorSave.ts
│   │   │   ├── imageViewer.test.ts
│   │   │   ├── imageViewer.ts
│   │   │   ├── scrollSync.test.ts
│   │   │   └── scrollSync.ts
│   │   ├── library.test.ts
│   │   ├── library.ts
│   │   ├── settings
│   │   │   ├── theme.tet.ts
│   │   │   └── theme.ts
│   │   ├── stores.ts
│   │   ├── task
│   │   │   ├── taskService.test.ts
│   │   │   └── taskService.ts
│   │   ├── utils
│   │   │   ├── tagUtils.test.ts
│   │   │   └── tagUtils.ts
│   │   └── workspace
│   │       ├── menuUtils.ts
│   │       ├── treeUtils.test.ts
│   │       └── treeUtils.ts
│   └── routes
│       ├── +layout.svelte
│       ├── +layout.ts
│       └── +page.svelte
├── src-tauri
│   ├── .gitignore
│   ├── 2
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── build.rs
│   ├── capabilities
│   │   ├── default.json
│   │   └── desktop.json
│   ├── gen
│   │   └── schemas
│   │       ├── acl-manifests.json
│   │       ├── capabilities.json
│   │       ├── desktop-schema.json
│   │       └── windows-schema.json
│   ├── src
│   │   ├── dashboard_ops.rs
│   │   ├── file_ops.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── models.rs
│   │   ├── search_ops.rs
│   │   └── task_ops.rs
│   └── tauri.conf.json
├── static
│   ├── favicon.png
│   ├── svelte.svg
│   ├── tauri.svg
│   └── vite.svg
├── svelte.config.js
├── test-cases
├── tsconfig.json
└── vite.config.js
```

## 依存関係
📄 `scripts/generate_filemap.js`
  └── import fs
  └── import path

📄 `scripts/generate_filemap.test.js`
  └── import vitest
  └── import ./generate_filemap.js
  └── import $lib/components
  └── import lucide-svelte

📄 `src/components/Editor/Editor.svelte`
  └── import $lib/stores
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import svelte
  └── import lucide-svelte
  └── import ./EditorHeader.svelte
  └── import ./TabBar.svelte
  └── import ./EditorPreview.svelte
  └── import ./EditorSearch.svelte
  └── import ../../lib/stores
  └── import ../../lib/editor/editorSave
  └── import ../../lib/editor/scrollSync
  └── import ../../features/Task/TaskList.svelte

📄 `src/components/Editor/EditorHeader.svelte`
  └── import @tauri-apps/api/core
  └── import lucide-svelte

📄 `src/components/Editor/EditorPreview.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import ../../lib/stores
  └── import ../../lib/editor/imageViewer
  └── import @tauri-apps/plugin-opener
  └── import lucide-svelte
  └── import ./previewExtensions
  └── import ../../features/Dashboard/DashboardManager
  └── import ./markdownSetup
  └── import dompurify

📄 `src/components/Editor/EditorSearch.svelte`
  └── import @tauri-apps/api/core
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils
  └── import lucide-svelte

📄 `src/components/Editor/TabBar.svelte`
  └── import ../../lib/stores
  └── import @tauri-apps/api/core
  └── import lucide-svelte
  └── import ../../features/ContextMenu.svelte
  └── import ../../lib/workspace/menuUtils
  └── import ../../lib/utils/tagUtils
  └── import svelte

📄 `src/components/Editor/markdownSetup.ts`
  └── import marked
  └── import dompurify
  └── import svelte/store
  └── import ../../lib/stores
  └── import ../../lib/editor/imageViewer
  └── import ./previewExtensions

📄 `src/components/Editor/previewExtensions.test.ts`
  └── import vitest
  └── import ./previewExtensions

📄 `src/components/Modals/NewFileModal.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import ../../lib/stores

📄 `src/components/Modals/SmartFolderModal.svelte`
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import svelte

📄 `src/components/Modals/WorkspaceManager.svelte`
  └── import svelte
  └── import @tauri-apps/plugin-dialog
  └── import ../../lib/stores

📄 `src/components/Settings/SettingsModal.svelte`
  └── import svelte
  └── import ./ThemeSettings.svelte
  └── import ./StyleSettings.svelte
  └── import ../../features/styleSettings/styleStore
  └── import ../../lib/settings/theme
  └── import ../../lib/stores
  └── import @tauri-apps/plugin-dialog
  └── import ../../lib/stores
  └── import @tauri-apps/api/core

📄 `src/components/Settings/StyleSettings.svelte`
  └── import ../../features/styleSettings/styleStore

📄 `src/components/Settings/ThemeSettings.svelte`
  └── import ../../lib/settings/theme
  └── import svelte/store

📄 `src/components/Settings/ThemeSettings.tst.ts`
  └── import vitest
  └── import @testing-library/svelte
  └── import ./ThemeSettings.svelte
  └── import ../../lib/settings/theme

📄 `src/components/Sidebar/SidebarFooter.svelte`
  └── import @tauri-apps/api/webviewWindow
  └── import lucide-svelte

📄 `src/components/Sidebar/SidebarHeader.svelte`
  └── import svelte
  └── import @tauri-apps/plugin-dialog
  └── import lucide-svelte
  └── import ../../lib/stores

📄 `src/components/Sidebar/SidebarLinks.svelte`
  └── import @tauri-apps/plugin-opener

📄 `src/components/Sidebar/SidebarTree.svelte`
  └── import ../TreeNode.svelte
  └── import lucide-svelte
  └── import ../../lib/stores

📄 `src/components/TreeNode.svelte`
  └── import @tauri-apps/api/core
  └── import ../lib/stores
  └── import svelte
  └── import lucide-svelte
  └── import ../lib/utils/tagUtils
  └── import ../features/ContextMenu.svelte
  └── import ../lib/workspace/menuUtils

📄 `src/features/ContextMenu.svelte`
  └── import ../lib/workspace/menuUtils
  └── import lucide-svelte

📄 `src/features/Dashboard/DashboardManager.ts`
  └── import svelte
  └── import ./widgets/SearchWidget.svelte

📄 `src/features/Dashboard/widgets/SearchWidget.svelte`
  └── import @tauri-apps/api/core
  └── import svelte
  └── import ../../../lib/stores
  └── import ../../../lib/workspace/treeUtils
  └── import lucide-svelte

📄 `src/features/Task/TaskItem.svelte`
  └── import svelte
  └── import ../../lib/task/taskService

📄 `src/features/Task/TaskList.svelte`
  └── import svelte
  └── import lucide-svelte
  └── import @tauri-apps/api/core
  └── import ../../lib/task/taskService
  └── import ./TaskItem.svelte
  └── import ../../lib/stores
  └── import ../../lib/workspace/treeUtils
  └── import ../ContextMenu.svelte
  └── import ../../lib/workspace/menuUtils

📄 `src/features/launcher/+page.svelte`
  └── import ../../features/launcher/LauncherWindow.svelte

📄 `src/features/launcher/LauncherWindow.svelte`
  └── import svelte
  └── import @tauri-apps/api/core
  └── import @tauri-apps/api/event
  └── import @tauri-apps/api/window

📄 `src/features/styleSettings/styleStore.test.ts`
  └── import vitest
  └── import ./styleStore

📄 `src/features/styleSettings/styleStore.ts`
  └── import svelte/store
  └── import ../../lib/stores

📄 `src/lib/editor/editorSave.test.ts`
  └── import vitest
  └── import ./editorSave

📄 `src/lib/editor/imageViewer.test.ts`
  └── import vitest
  └── import ./imageViewer

📄 `src/lib/editor/imageViewer.ts`
  └── import @tauri-apps/api/core

📄 `src/lib/editor/scrollSync.test.ts`
  └── import vitest
  └── import ./scrollSync

📄 `src/lib/library.test.ts`
  └── import vitest
  └── import ./library

📄 `src/lib/settings/theme.tet.ts`
  └── import vitest
  └── import svelte/store
  └── import ./theme

📄 `src/lib/settings/theme.ts`
  └── import svelte/store

📄 `src/lib/stores.ts`
  └── import svelte/store
  └── import @tauri-apps/api/core

📄 `src/lib/task/taskService.test.ts`
  └── import vitest
  └── import ./taskService

📄 `src/lib/task/taskService.ts`
  └── import @tauri-apps/api/core

📄 `src/lib/utils/tagUtils.test.ts`
  └── import vitest
  └── import ./tagUtils

📄 `src/lib/workspace/menuUtils.ts`
  └── import lucide-svelte
  └── import svelte

📄 `src/lib/workspace/treeUtils.test.ts`
  └── import vitest

📄 `src/lib/workspace/treeUtils.ts`
  └── import @tauri-apps/api/core

📄 `src/routes/+page.svelte`
  └── import svelte
  └── import @tauri-apps/api/core
  └── import @tauri-apps/plugin-dialog
  └── import @tauri-apps/plugin-opener
  └── import @tauri-apps/api/window
  └── import ../components/Editor/Editor.svelte
  └── import ../components/TreeNode.svelte
  └── import ../components/Settings/SettingsModal.svelte
  └── import ../components/Modals/NewFileModal.svelte
  └── import ../components/Modals/SmartFolderModal.svelte
  └── import ../components/Modals/WorkspaceManager.svelte
  └── import ../components/Sidebar/SidebarHeader.svelte
  └── import ../components/Sidebar/SidebarTree.svelte
  └── import ../components/Sidebar/SidebarFooter.svelte
  └── import ../components/Sidebar/SidebarLinks.svelte
  └── import ../lib/settings/theme
  └── import ../features/styleSettings/styleStore
  └── import ../lib/stores
  └── import ../lib/library
  └── import @tauri-apps/api/event
  └── import ../features/launcher/LauncherWindow.svelte
  └── import ../lib/workspace/treeUtils

📄 `src-tauri/src/dashboard_ops.rs`
  └── use/mod std::fs
  └── use/mod std::path::PathBuf
  └── use/mod tauri::{AppHandle, Manager}
  └── use/mod crate::file_ops::atomic_write

📄 `src-tauri/src/file_ops.rs`
  └── use/mod std::fs
  └── use/mod std::io::Write
  └── use/mod tauri::{AppHandle, Manager}
  └── use/mod crate::{Workspace, VirtualNode}
  └── use/mod tests {
    use super::*

📄 `src-tauri/src/lib.rs`
  └── use/mod dashboard_ops
  └── use/mod std::fs
  └── use/mod tauri::Manager
  └── use/mod std::collections::HashMap

📄 `src-tauri/src/models.rs`
  └── use/mod serde::{Deserialize, Serialize}

📄 `src-tauri/src/search_ops.rs`
  └── use/mod std::fs
  └── use/mod serde::Serialize
  └── use/mod crate::models::VirtualNode

📄 `src-tauri/src/task_ops.rs`
  └── use/mod serde::{Deserialize, Serialize}
  └── use/mod std::fs::{self, File}
  └── use/mod std::io::{self, BufRead, Write}
  └── use/mod std::path::{Path, PathBuf}
  └── use/mod crate::VirtualNode
  └── use/mod crate::search_ops

📄 `svelte.config.js`
  └── import @sveltejs/adapter-static
  └── import @sveltejs/vite-plugin-svelte

📄 `vite.config.js`
  └── import vite
  └── import @sveltejs/kit/vite
  └── import @tailwindcss/vite

## 各ファイル詳細

### scripts/
- `scripts/generate_filemap.js` : （説明未記載）
  - `export const Extractor`
- `scripts/generate_filemap.test.js` : （説明未記載）

### src/components/Editor/
- `src/components/Editor/Editor.svelte` : エディタ画面を統括する親部品
- `src/components/Editor/EditorHeader.svelte` : --- START OF src/components/EditorHeader.svelte ---
  - `export let activeTab`
  - `export let toggleEditMode`
- `src/components/Editor/EditorPreview.svelte` : Markdownを綺麗に表示し、ユーザーがクリックしたイベントを外に教える
  - `export let activeTab`
  - `export let scrollContainer`
- `src/components/Editor/EditorSearch.svelte` : 検索機能と結果表示
- `src/components/Editor/TabBar.svelte` : --- START OF src/components/Editor/TabBar.svelte ---
  - `export let handleTabClick`
  - `export let handleTabClose`
- `src/components/Editor/markdownSetup.ts` : Markdown文字列を安全なHTMLに変換し、独自記法(マークや画像、ダッシュボード拡張)を適用する
  - `export function removeFrontmatter(content: string)`
  - `export function sanitizeHtml(rawHtml: string)`
  - `export function parseMarkdown(content: string, tabPath: string)`
- `src/components/Editor/previewExtensions.test.ts` : 前後のコード明確化: src/features/previewExtensions/previewExtensions.test.ts
- `src/components/Editor/previewExtensions.ts` : プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作
  - `export const COPY_ICON_SVG`
  - `export const CHECK_ICON_SVG`
  - `export function toggleTaskMarkdown(content: string, targetIndex: number)`
  - `export async function copyCodeBlock(buttonEl: HTMLElement)`
  - `export function toggleHeadingCollapse(headingEl: HTMLElement)`

### src/components/Modals/
- `src/components/Modals/NewFileModal.svelte` : --- START OF src/components/Modals/NewFileModal.svelte ---
  - `export let isOpen`
  - `export let targetDir`
- `src/components/Modals/SmartFolderModal.svelte` : --- START OF src/components/Modals/SmartFolderModal.svelte ---
  - `export let isOpen`
  - `export let editingSmartNode`
  - `export let workspaceNodes`
- `src/components/Modals/WorkspaceManager.svelte` : --- START OF src/components/Modals/WorkspaceManager.svelte ---
  - `export let workspaces`
  - `export let currentIndex`
  - `export let editingListIndex`
  - `export let isCreateModalOpen`
  - `export let isManageModalOpen`
  - `export let isImportLibraryModalOpen`

### src/components/Settings/
- `src/components/Settings/SettingsModal.svelte` : --- START OF src/components/SettingsModal.svelte ---
  - `export let workspaces`
  - `export let currentIndex`
- `src/components/Settings/StyleSettings.svelte` : --- START OF src/components/StyleSettings.svelte ---
  - `export let tempStyle`
  - `export let tempCustomSlots`
  - `export let defaultStyle`
- `src/components/Settings/ThemeSettings.svelte` : （説明未記載）
  - `export let tempTheme`
  - `export function applyPreset()`
  - `export function saveCustomTheme()`
- `src/components/Settings/ThemeSettings.tst.ts` : （説明未記載）

### src/components/Sidebar/
- `src/components/Sidebar/SidebarFooter.svelte` : サイドバー下部のリスト切り替え・設定ボタン
  - `export let workspaces`
  - `export let currentIndex`
  - `export let editingListIndex`
  - `export let isCreateModalOpen`
  - `export let isManageModalOpen`
  - `export let isImportLibraryModalOpen`
  - `export let openSettings`
- `src/components/Sidebar/SidebarHeader.svelte` : サイドバー上部の新規追加ボタン等
  - `export let workspaces`
  - `export let currentIndex`
- `src/components/Sidebar/SidebarLinks.svelte` : 責務: サイドバー内の外部リンク一覧の表示・コンテキストメニューおよび開く処理の管理
  - `export let links`
  - `export let onLinkDelete`
- `src/components/Sidebar/SidebarTree.svelte` : サイドバーのツリー表示とピン留め
  - `export let workspaces`
  - `export let currentIndex`
  - `export let unpin`

### src/components/
- `src/components/TreeNode.svelte` : （説明未記載）
  - `export let node`
  - `export let ownerId`
  - `export let isLibraryNode`

### src/features/
- `src/features/ContextMenu.svelte` : 右クリックメニューのUI。画面外をクリックしたら自動で閉じる
  - `export let x`
  - `export let y`
  - `export let items`
  - `export let openSubLeft`
  - `export let onClose`

### src/features/Dashboard/
- `src/features/Dashboard/DashboardManager.ts` : プレビュー画面上のプレースホルダー(div)にSvelteコンポーネントをマウント・アンマウントする (Svelte 5対応版)
  - `export function unmountAllWidgets()`
  - `export function mountWidgets(container: HTMLElement)`

### src/features/Dashboard/widgets/
- `src/features/Dashboard/widgets/SearchWidget.svelte` : 渡されたクエリで検索を実行し、結果をコンパクトなリストで表示する
  - `export let query`

### src/features/Task/
- `src/features/Task/TaskItem.svelte` : タスク1件分のUI表示と、チェックボックス操作のイベント発火
  - `export let task`
  - `export let isUpdating`
- `src/features/Task/TaskList.svelte` : 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント
  - `export let workspaceIndex`

### src/features/launcher/
- `src/features/launcher/+page.svelte` : 責務: ランチャーウィンドウ用のルーティングエントリポイント
- `src/features/launcher/LauncherWindow.svelte` : 責務: 独立した小ウィンドウでワークスペースの一覧を表示し、選択結果をメイン画面に送信する

### src/features/styleSettings/
- `src/features/styleSettings/styleStore.test.ts` : （説明未記載）
- `src/features/styleSettings/styleStore.ts` : （説明未記載）
  - `export interface HeadingStyle`
  - `export interface StyleSlot`
  - `export const defaultStyle`
  - `export const activeStyleSlot`
  - `export const customStyleSlots`
  - `export function generateStyleCssVariables(style: StyleSlot)`
  - `export function applyStyleToRoot(style: StyleSlot)`
  - `export function initStyles()`

### src/lib/editor/
- `src/lib/editor/editorSave.test.ts` : editorSave関数の単体テスト
- `src/lib/editor/editorSave.ts` : エディタの保存処理、競合ダイアログハンドリングの純粋・抽象化ロジック
  - `export interface SaveDependencies`
  - `export interface BaseTabData`
- `src/lib/editor/imageViewer.test.ts` : --- START OF src/lib/imageViewer.test.ts ---
- `src/lib/editor/imageViewer.ts` : --- START OF src/lib/editor/imageViewer.ts ---
  - `export function generateImageHtml(filenameWithOpts: string, activeTabPath: string, imageFolders: string[] = [])`
  - `export async function loadImagesInDom()`
- `src/lib/editor/scrollSync.test.ts` : scrollSync関数の単体テスト
- `src/lib/editor/scrollSync.ts` : 編集エリアとプレビューエリア間のスクロール位置比率の計算を行う純粋関数
  - `export function calculateScrollRatio(scrollTop: number, scrollHeight: number)`
  - `export function calculateScrollTopFromRatio(ratio: number, scrollHeight: number)`

### src/lib/
- `src/lib/library.test.ts` : --- START OF src/lib/library.test.ts ---
- `src/lib/library.ts` : --- START OF src/lib/library.ts ---
  - `export function cloneNodeAsIndependent(node: any)`
- `src/lib/stores.ts` : Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）
  - `export interface TabData`
  - `export const workspacesStore`
  - `export const openTabs`
  - `export const activeTabId`
  - `export const workspaces`
  - `export const currentWorkspace`
  - `export const editorFont`
  - `export const currentWorkspaceIndex`
  - `export const registeredTags`
  - `export const searchState`
  - `export const expandTreeRequest`
  - `export function openSearchTab()`
  - `export function openTaskTab()`
  - `export function switchTab(tabId: string)`
  - `export function openFileInCurrentTab(filePath: string, title: string, initialContent: string)`
  - `export function openFileInNewTab(filePath: string, title: string, initialContent: string)`
  - `export function createNewTab()`
  - `export function closeTab(idToClose: string)`
  - `export const showLauncherOnStartup`
  - `export async function openDashboardTab(workspaceId: string, workspaceName: string)`

### src/lib/settings/
- `src/lib/settings/theme.tet.ts` : （説明未記載）
- `src/lib/settings/theme.ts` : テーマ設定のプリセット、起動時テーマ復元処理、テーマ適用
  - `export interface Theme`
  - `export const defaultThemes`
  - `export const activeTheme`
  - `export const customThemes`
  - `export function initTheme()`
  - `export function applyThemeToRoot(theme: Theme)`

### src/lib/task/
- `src/lib/task/taskService.test.ts` : taskServiceの単体テスト
- `src/lib/task/taskService.ts` : 責務: Tauriと通信し、タスクの取得および完了処理を行うAPIサービス
  - `export interface Task`
  - `export interface TaskScanOptions`
  - `export async function fetchWorkspaceTasks(nodes: any[], options?: TaskScanOptions)`
  - `export async function completeTaskStatus(task: Task, completed: boolean = true)`

### src/lib/utils/
- `src/lib/utils/tagUtils.test.ts` : （説明未記載）
- `src/lib/utils/tagUtils.ts` : タグの文字列処理など（純粋関数）
  - `export function extractTags(content: string)`
  - `export function updateTagsInContent(content: string, tag: string, isAdd: boolean)`

### src/lib/workspace/
- `src/lib/workspace/menuUtils.ts` : 右クリックメニューを表示するデータ構造を定義し、ファイル共通のアクションを生成
  - `export interface MenuItem`
  - `export interface FileMenuParams`
  - `export function buildCommonFileMenu(params: FileMenuParams)`
- `src/lib/workspace/treeUtils.test.ts` : 責務: treeUtils関数の単体テスト
- `src/lib/workspace/treeUtils.ts` : ワークスペースのノードツリー最新化およびスマートフォルダ評価、ワークスペースのファイル一覧取得
  - `export async function refreshTree(nodes: any[], workspaceNodes: any[])`

### src/routes/
- `src/routes/+layout.svelte` : （説明未記載）
- `src/routes/+layout.ts` : Tauri doesn't have a Node.js server to do proper SSR
  - `export const ssr`
- `src/routes/+page.svelte` : アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。

### src-tauri/
- `src-tauri/build.rs` : （説明未記載）

### src-tauri/src/
- `src-tauri/src/dashboard_ops.rs` : アプリ設定ディレクトリ内でのダッシュボード専用ファイルの読み込みと、アトミック保存を行う
  - `pub fn load_dashboard(app: AppHandle, workspace_id: String) -> Result<String, String>`
  - `pub fn save_dashboard(app: AppHandle, workspace_id: String, content: String) -> Result<(), String>`
- `src-tauri/src/file_ops.rs` : ファイル保存、読み込み関係。
  - `pub fn atomic_write(path: &std::path::Path, content: &[u8]) -> Result<(), String>`
  - `pub fn get_file_modified(path: String) -> Result<u64, String>`
  - `pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<(), String>`
  - `pub fn load_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String>`
  - `pub fn save_file_content(path: String, content: String, last_modified: u64, force: bool) -> Result<u64, String>`
  - `pub fn read_file_content(path: String) -> Result<Vec<u8>, String>`
  - `pub fn read_directory(path: String) -> Result<Vec<VirtualNode>, String>`
  - `pub fn create_new_file(dir_path: String, file_name: String, insert_tag: String) -> Result<(), String>`
  - `pub fn open_folder(path: String) -> Result<(), String>`
  - `pub async fn find_image_file(dir_path: String, file_name: String) -> Result<Option<String>, String>`
  - `pub fn check_file_exists(path: String) -> bool`
- `src-tauri/src/lib.rs` : 全てのTauriコマンド（ファイル検索、OS連携など）が書かれたメイン処理。（今後は少しずつ分割する）
  - `pub fn run()`
- `src-tauri/src/main.rs` : Prevents additional console window on Windows in release, DO NOT REMOVE!!
- `src-tauri/src/models.rs` : アプリケーション全体で使用する共通データモデル（Workspace, VirtualNode など）の定義
  - `pub struct PinnedItem`
  - `pub struct LinkItem`
  - `pub struct SavedTab`
  - `pub enum SmartCondition`
  - `pub struct SmartRules`
  - `pub enum VirtualNode`
  - `pub struct Workspace`
- `src-tauri/src/search_ops.rs` : 画面上の仮想ツリー（VirtualNode）を対象とした高速ファイル検索コマンドおよび関連処理
  - `pub struct SearchResultItem`
  - `pub fn extract_files_from_nodes(nodes: &[VirtualNode]) -> Vec<(String, String)>`
  - `pub async fn search_files( nodes: Vec<VirtualNode>, search_by_filename: bool, query: String, ) -> Result<Vec<SearchResultItem>, String>`
- `src-tauri/src/task_ops.rs` : 責務: ワークスペース内のタスク検索と、タスク状態の安全な更新処理
  - `pub struct Task`
  - `pub struct ScanOptions`
  - `pub async fn get_workspace_tasks( nodes: Vec<VirtualNode>, options: Option<ScanOptions> ) -> Result<Vec<Task>, String>`
  - `pub fn complete_task( file_path: String, line_number: usize, original_text: String, completed: Option<bool>, ) -> Result<(), String>`

- `svelte.config.js` : Tauri doesn't have a Node.js server to do proper SSR
- `vite.config.js` : （説明未記載）

