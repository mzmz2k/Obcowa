# ディレクトリ構成と主要ファイル
※依存関係はインデントによって表現しています

## バックエンド (Rust)
- `src-tauri/src/lib.rs` : 全てのTauriコマンド（ファイル検索、OS連携など）が書かれたメイン処理。（今後は少しずつ分割する）
- `src-tauri/src/file_ops.rs` : ファイル保存。
- `src-tauri/tauri.conf.json` : Tauriの基本設定やパーミッション。


## フロントエンド (SvelteKit)
- `src/routes/+page.svelte` : アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。
- `src/components/Sidebar/` : 左サイドバー関連
  - `SidebarHeader.svelte` : 上部の新規追加ボタン等
  - `SidebarTree.svelte` : ツリー表示とピン留め
  - `SidebarFooter.svelte` : 下部のリスト切り替え・設定ボタン
- `src/components/Editor/` : 右エディタ関連
  - `Editor.svelte` : エディタ画面を統括する親部品
  - `EditorSearch.svelte` : 検索機能と結果表示
- `src/components/Modals/`
- `src/components/Settings/`


- `src/lib/stores.ts` : Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）（多数に依存されています　変更時要確認）
- `src/lib/editor/`
- `src/lib/settings/`
- `src/lib/utils/` : 計算ロジック
  - `tagUtils.ts` : タグの文字列処理など（純粋関数）