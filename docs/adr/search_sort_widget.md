# 検索・ウィジェットのソート拡張機能 設計ドキュメント

## 要件
- 検索結果に「ファイル名・作成日・更新日」でのソート機能を追加する。
- 検索ソートの設定はワークスペースごとに保存・復元される。
- ダッシュボードからは、Markdownの専用コードブロック（Dataview風）を用いて、UIなしでソート済み検索結果を呼び出せるようにする。

## データモデルの変更
- **Rust (`models.rs`)**: `Workspace` に `search_sort_by` (String) と `search_sort_order` (String) を追加。
- **Rust (`search_ops.rs`)**: `SearchResultItem` に `created_at` (u64) と `updated_at` (u64) を追加。

## ロジックの分割
- **クエリパーサー**: SvelteのMarkdown変換処理にフックし、`WHERE` と `SORT` コマンドを解釈する純粋関数を実装。
  - マッピング: `file.ctime` -> 作成日, `file.mtime` -> 更新日, `file.name` -> ファイル名
- **ソート純粋関数 (`src/lib/utils/searchUtils.ts`)**: フロントエンド側で配列を並び替えるロジックを独立させる。エディタ検索とウィジェットの両方から呼び出す。

## UIの役割
- **`EditorSearch.svelte`**: 手動検索入力と、ソート条件を切り替えるトグルアイコン（Lucide）を持つ。操作時に状態を即時保存する。
- **`SearchWidget.svelte`**: ソートUIは持たない。パーサーから渡された `query`, `sortKey`, `sortOrder` を元にデータを取得し、表示するだけのViewコンポーネント。