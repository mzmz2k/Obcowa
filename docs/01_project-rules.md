# プロジェクトの基本情報とルール

## 技術スタック
- フロントエンド: SvelteKit (Svelte 4/5), TailwindCSS, lucide-svelte, Vitest
- バックエンド: Tauri v2 (Rust)
- DB/認証: なし（ローカルの.md/.txtファイルを直接操作）
- 通信: Tauri IPC (フロントから `invoke` でRustを呼び出す)

## コンセプト
Obsidianを母艦として、プロジェクトごとにワークスペースを構成できるMarkdownエディタ。
ファイル・ワークスペースが消えないこと、Obsidianの管理に干渉しないことを優先する。

## 絶対ルール（AIへの指示）
- **テーマ対応**: Tailwindで `bg-gray-700` のような具体的な色指定は禁止。必ず以下のCSS変数を使うこと。
【使用可能なCSS変数一覧】
  - `var(--bg-color)` : メイン背景色
  - `var(--text-color)` : メイン文字色
  - `var(--menu-bg)` : メニューやサイドバーの背景色
  - `var(--active-highlight-bg)` : ホバー時や選択時の背景色
  - `var(--accent-color)` : ボタンやアイコンのアクセントカラー
  - `var(--selection-bg)`：文字を選択したときの背景色
※半透明にしたい場合は `color-mix(in srgb, var(--text-color) 20%, transparent)` のようにすること。
アクセントカラーを文字色に使うときは、テキスト色を混ぜる
例：color-mix(in srgb, var(--accent-color) 80%, var(--text-color))
- **ワークスペース設定（workspaces.json）の保存ルール**:
  - 各コンポーネントから Tauri の `invoke('save_workspaces')` を直接呼び出すことは**厳禁**（データの巻き戻り・Race Conditionの原因になるため）。
  - 設定の保存は必ず `src/lib/workspace/workspaceManager.ts` の `requestSaveWorkspaces()` を使用すること。この関数が内部で直列化（キュー）とウィンドウ間マージを安全に行う。
  - ワークスペースのデータはローカル変数で保持・バケツリレーせず、グローバルストア `$workspacesStore` を直接参照・`workspacesStore.update()` で更新すること。
- **ファイルの配置ルール（Co-locationの原則）**:
  - 単一のコンポーネントでしか使わないロジック・テストは、そのコンポーネントと同じディレクトリ内に配置すること（例: `src/components/Editor/previewExtensions.ts`）。
  - アプリから独立した大きな画面や機能ユニット（ランチャーや設定等）、フォルダの違う複数コンポーネントから呼び出される処理は `src/features/機能名/` 配下にまとめること。
  - アプリ全体（複数コンポーネント）で横断利用する共通ロジックやストアは `src/lib/` 配下に配置すること。
- 特殊パス（仮想タブ）はsrc/lib/utils/pathUtils.tsで管理する。新しい機能を作ったらここに追記。
- 既存のコードでリファクタリングできそうな部分（責務の分離など）があれば教えてください
- OSSで公開するので、セキュリティリスク（開発者の情報漏洩）などがある場合は通知する。
- マークダウンの表示やメニューアイコンなどは、特に指示がない場合はObsidian風にする
