# ディレクトリ構成と主要ファイル

```
A03_Obcowa/
├── .githooks
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
│   │   │   └── TabBar.svelte
│   │   ├── Modals
│   │   │   ├── NewFileModal.svelte
│   │   │   ├── SmartFolderModal.svelte
│   │   │   └── WorkspaceManager.svelte
│   │   ├── Settings
│   │   │   ├── SettingsModal.svelte
│   │   │   ├── StyleSettings.svelte
│   │   │   ├── ThemeSettings.svelte
│   │   │   └── ThemeSettings.test.ts
│   │   ├── Sidebar
│   │   │   ├── SidebarFooter.svelte
│   │   │   ├── SidebarHeader.svelte
│   │   │   └── SidebarTree.svelte
│   │   └── TreeNode.svelte
│   ├── features
│   │   └── styleSettings
│   │       ├── styleStore.test.ts
│   │       └── styleStore.ts
│   ├── lib
│   │   ├── editor
│   │   │   ├── imageViewer.test.ts
│   │   │   └── imageViewer.ts
│   │   ├── library.test.ts
│   │   ├── library.ts
│   │   ├── settings
│   │   │   ├── theme.test.ts
│   │   │   └── theme.ts
│   │   ├── stores.ts
│   │   └── utils
│   │       ├── tagUtils.test.ts
│   │       └── tagUtils.ts
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

📄 `src/components/Settings/StyleSettings.svelte`
  └── import ../../features/styleSettings/styleStore

📄 `src/components/Settings/ThemeSettings.svelte`
  └── import ../../lib/settings/theme
  └── import svelte/store

📄 `src/components/Settings/ThemeSettings.test.ts`
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

📄 `src/components/Sidebar/SidebarTree.svelte`
  └── import ../TreeNode.svelte
  └── import lucide-svelte

📄 `src/components/TreeNode.svelte`
  └── import @tauri-apps/api/core
  └── import ../lib/stores
  └── import svelte
  └── import lucide-svelte
  └── import ../lib/utils/tagUtils

📄 `src/features/styleSettings/styleStore.test.ts`
  └── import vitest
  └── import ./styleStore

📄 `src/features/styleSettings/styleStore.ts`
  └── import svelte/store
  └── import ../../lib/stores

📄 `src/lib/editor/imageViewer.test.ts`
  └── import vitest
  └── import ./imageViewer

📄 `src/lib/editor/imageViewer.ts`
  └── import @tauri-apps/api/core

📄 `src/lib/library.test.ts`
  └── import vitest
  └── import ./library

📄 `src/lib/settings/theme.test.ts`
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
  └── import ../lib/settings/theme
  └── import ../features/styleSettings/styleStore
  └── import ../lib/stores
  └── import ../lib/library
  └── import lucide-svelte

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
`src/components/Editor/EditorPreview.svelte` : --- START OF src/components/Editor/EditorPreview.svelte ---
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
`src/components/Settings/ThemeSettings.test.ts` : （説明未記載）

### src/components/Sidebar/
`src/components/Sidebar/SidebarFooter.svelte` : サイドバー下部のリスト切り替え・設定ボタン
`src/components/Sidebar/SidebarHeader.svelte` : サイドバー上部の新規追加ボタン等
`src/components/Sidebar/SidebarTree.svelte` : サイドバーのツリー表示とピン留め

### src/components/
`src/components/TreeNode.svelte` : （説明未記載）

### src/features/styleSettings/
`src/features/styleSettings/styleStore.test.ts` : （説明未記載）
`src/features/styleSettings/styleStore.ts` : （説明未記載）

### src/lib/editor/
`src/lib/editor/imageViewer.test.ts` : --- START OF src/lib/imageViewer.test.ts ---
`src/lib/editor/imageViewer.ts` : --- START OF src/lib/editor/imageViewer.ts ---

### src/lib/
`src/lib/library.test.ts` : --- START OF src/lib/library.test.ts ---
`src/lib/library.ts` : --- START OF src/lib/library.ts ---
`src/lib/stores.ts` : Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）

### src/lib/settings/
`src/lib/settings/theme.test.ts` : （説明未記載）
`src/lib/settings/theme.ts` : （説明未記載）

### src/lib/utils/
`src/lib/utils/tagUtils.test.ts` : （説明未記載）
`src/lib/utils/tagUtils.ts` : タグの文字列処理など（純粋関数）

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

