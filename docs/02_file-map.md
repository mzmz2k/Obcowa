# ディレクトリ構成と主要ファイル

```
A03_Obcowa/
├── .githooks
│   ├── pre-commit
│   └── pre-push
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
│   │   │   └── TabBar.svelte
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
│   │   ├── launcher
│   │   │   ├── +page.svelte
│   │   │   └── LauncherWindow.svelte
│   │   ├── previewExtensions
│   │   │   ├── previewExtensions.test.ts
│   │   │   └── previewExtensions.ts
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
│   │   ├── utils
│   │   │   ├── tagUtils.test.ts
│   │   │   └── tagUtils.ts
│   │   └── workspace
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
│   │   ├── file_ops.rs
│   │   ├── lib.rs
│   │   └── main.rs
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

📄 `src/components/Editor/EditorHeader.svelte`
  └── import @tauri-apps/api/core
  └── import lucide-svelte

📄 `src/components/Editor/EditorPreview.svelte`
  └── import @tauri-apps/api/core
  └── import marked
  └── import dompurify
  └── import svelte
  └── import ../../lib/stores
  └── import ../../lib/editor/imageViewer
  └── import @tauri-apps/plugin-opener
  └── import lucide-svelte
  └── import ../../features/previewExtensions/previewExtensions

📄 `src/components/Editor/EditorSearch.svelte`
  └── import @tauri-apps/api/core
  └── import ../../lib/stores
  └── import lucide-svelte

📄 `src/components/Editor/TabBar.svelte`
  └── import ../../lib/stores
  └── import @tauri-apps/api/core
  └── import lucide-svelte
  └── import ../../lib/utils/tagUtils

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

📄 `src/components/TreeNode.svelte`
  └── import @tauri-apps/api/core
  └── import ../lib/stores
  └── import svelte
  └── import lucide-svelte
  └── import ../lib/utils/tagUtils

📄 `src/features/launcher/+page.svelte`
  └── import ../../features/launcher/LauncherWindow.svelte

📄 `src/features/launcher/LauncherWindow.svelte`
  └── import svelte
  └── import @tauri-apps/api/core
  └── import @tauri-apps/api/event
  └── import @tauri-apps/api/window

📄 `src/features/previewExtensions/previewExtensions.test.ts`
  └── import vitest
  └── import ./previewExtensions

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

📄 `src/lib/utils/tagUtils.test.ts`
  └── import vitest
  └── import ./tagUtils

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

📄 `src-tauri/src/file_ops.rs`
  └── use/mod std::fs
  └── use/mod std::io::Write
  └── use/mod tauri::{AppHandle, Manager}
  └── use/mod crate::{Workspace, VirtualNode}
  └── use/mod tests {
    use super::*

📄 `src-tauri/src/lib.rs`
  └── use/mod file_ops
  └── use/mod serde::{Deserialize, Serialize}
  └── use/mod std::fs
  └── use/mod tauri::Manager
  └── use/mod std::collections::HashMap

📄 `svelte.config.js`
  └── import @sveltejs/adapter-static
  └── import @sveltejs/vite-plugin-svelte

📄 `vite.config.js`
  └── import vite
  └── import @sveltejs/kit/vite
  └── import @tailwindcss/vite

## 各ファイル詳細

### scripts/
`scripts/generate_filemap.js` : （説明未記載）
`scripts/generate_filemap.test.js` : （説明未記載）

### src/components/Editor/
`src/components/Editor/Editor.svelte` : エディタ画面を統括する親部品
`src/components/Editor/EditorHeader.svelte` : --- START OF src/components/EditorHeader.svelte ---
`src/components/Editor/EditorPreview.svelte` : Markdownを綺麗に表示し、ユーザーがクリックしたイベントを外に教える
`src/components/Editor/EditorSearch.svelte` : 検索機能と結果表示
`src/components/Editor/TabBar.svelte` : --- START OF src/components/Editor/TabBar.svelte ---

### src/components/Modals/
`src/components/Modals/NewFileModal.svelte` : --- START OF src/components/Modals/NewFileModal.svelte ---
`src/components/Modals/SmartFolderModal.svelte` : --- START OF src/components/Modals/SmartFolderModal.svelte ---
`src/components/Modals/WorkspaceManager.svelte` : --- START OF src/components/Modals/WorkspaceManager.svelte ---

### src/components/Settings/
`src/components/Settings/SettingsModal.svelte` : --- START OF src/components/SettingsModal.svelte ---
`src/components/Settings/StyleSettings.svelte` : --- START OF src/components/StyleSettings.svelte ---
`src/components/Settings/ThemeSettings.svelte` : （説明未記載）
`src/components/Settings/ThemeSettings.tst.ts` : （説明未記載）

### src/components/Sidebar/
`src/components/Sidebar/SidebarFooter.svelte` : サイドバー下部のリスト切り替え・設定ボタン
`src/components/Sidebar/SidebarHeader.svelte` : サイドバー上部の新規追加ボタン等
`src/components/Sidebar/SidebarLinks.svelte` : 責務: サイドバー内の外部リンク一覧の表示・コンテキストメニューおよび開く処理の管理
`src/components/Sidebar/SidebarTree.svelte` : サイドバーのツリー表示とピン留め

### src/components/
`src/components/TreeNode.svelte` : （説明未記載）

### src/features/launcher/
`src/features/launcher/+page.svelte` : 責務: ランチャーウィンドウ用のルーティングエントリポイント
`src/features/launcher/LauncherWindow.svelte` : 責務: 独立した小ウィンドウでワークスペースの一覧を表示し、選択結果をメイン画面に送信する

### src/features/previewExtensions/
`src/features/previewExtensions/previewExtensions.test.ts` : 前後のコード明確化: src/features/previewExtensions/previewExtensions.test.ts
`src/features/previewExtensions/previewExtensions.ts` : プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作

### src/features/styleSettings/
`src/features/styleSettings/styleStore.test.ts` : （説明未記載）
`src/features/styleSettings/styleStore.ts` : （説明未記載）

### src/lib/editor/
`src/lib/editor/editorSave.test.ts` : editorSave関数の単体テスト
`src/lib/editor/editorSave.ts` : エディタの保存処理、競合ダイアログハンドリングの純粋・抽象化ロジック
`src/lib/editor/imageViewer.test.ts` : --- START OF src/lib/imageViewer.test.ts ---
`src/lib/editor/imageViewer.ts` : --- START OF src/lib/editor/imageViewer.ts ---
`src/lib/editor/scrollSync.test.ts` : scrollSync関数の単体テスト
`src/lib/editor/scrollSync.ts` : 編集エリアとプレビューエリア間のスクロール位置比率の計算を行う純粋関数

### src/lib/
`src/lib/library.test.ts` : --- START OF src/lib/library.test.ts ---
`src/lib/library.ts` : --- START OF src/lib/library.ts ---
`src/lib/stores.ts` : Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）

### src/lib/settings/
`src/lib/settings/theme.tet.ts` : （説明未記載）
`src/lib/settings/theme.ts` : テーマ設定のプリセット、起動時テーマ復元処理、テーマ適用

### src/lib/utils/
`src/lib/utils/tagUtils.test.ts` : （説明未記載）
`src/lib/utils/tagUtils.ts` : タグの文字列処理など（純粋関数）

### src/lib/workspace/
`src/lib/workspace/treeUtils.test.ts` : 責務: treeUtils関数の単体テスト
`src/lib/workspace/treeUtils.ts` : 責務: ワークスペースのノードツリー最新化およびスマートフォルダ評価を行う関数群

### src/routes/
`src/routes/+layout.svelte` : （説明未記載）
`src/routes/+layout.ts` : Tauri doesn't have a Node.js server to do proper SSR
`src/routes/+page.svelte` : アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。

### src-tauri/
`src-tauri/build.rs` : （説明未記載）

### src-tauri/src/
`src-tauri/src/file_ops.rs` : ファイル保存、読み込み関係。
`src-tauri/src/lib.rs` : 全てのTauriコマンド（ファイル検索、OS連携など）が書かれたメイン処理。（今後は少しずつ分割する）
`src-tauri/src/main.rs` : Prevents additional console window on Windows in release, DO NOT REMOVE!!

`svelte.config.js` : Tauri doesn't have a Node.js server to do proper SSR
`vite.config.js` : （説明未記載）

