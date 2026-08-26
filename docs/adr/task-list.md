# 機能設計書: ワークスペースタスク一覧管理

## 1. 目的と概要
ワークスペース全体からMarkdownのタスク記法（`- [ ]` ）をスキャンし、一元的に一覧表示・操作できる機能を提供する。
将来的にランチャー画面等から複数ワークスペースのタスクを横断表示することを見据え、バックエンド主導のスキャンと、UI/ロジックの疎結合を前提としたアーキテクチャとする。

## 2. アーキテクチャ設計

### バックエンド (Rust / Tauri)
- **ファイルアクセス責務**: OSレイヤーでの高速な再帰的ファイルスキャンを担当。
- **提供コマンド**:
  - `get_workspace_tasks(workspace_path: &str)`: 指定ディレクトリ内のタスクを抽出。
  - `toggle_task_status(file_path: &str, line_number: usize, original_text: &str, is_completed: bool)`: タスク状態の更新。
- **安全設計 (Atomic Write & Optimistic Lock)**:
  - ファイルの特定行を更新する際、行番号のズレによるデータ破損を防ぐため、`original_text` が一致するか必ず検証する。
  - 保存中にアプリが落ちてもファイルが空にならないよう、必ず `.tmp` 一時ファイルに書き込んでからリネーム上書きする。

### フロントエンド (Svelte / TypeScript)
- **ロジック層 (`src/lib/task/taskService.ts`)**:
  - Rust APIとの通信と、タスクリストの状態管理を行う。UIに依存しないため、エディタ画面でもランチャー画面でも使い回せる。
- **UI層 (`src/components/Task/TaskList.svelte`)**:
  - `taskService` からデータを受け取り、一覧表示とチェックボックスのUIを提供する。
  - SvelteKitの思想に従い、CSS変数を活用して既存テーマ(`var(--bg-color)`等)に完全に適応させる。

## 3. データフロー
1. **[取得]**: User -> `TaskList.svelte` -> `taskService.fetchTasks` -> `Tauri Command` -> (FS Scan) -> 画面描画
2. **[更新]**: User (Check) -> `TaskList.svelte` -> `taskService.toggleTask` -> `Tauri Command` -> (整合性チェック -> Atomic Save) -> (File Updated Event発火) -> UI更新

## 4. データモデル定義
```typescript
export interface Task {
    filePath: string;
    lineNumber: number;
    text: string;           // "- [ ] " を除いた実際のタスク文言
    originalText: string;   // 整合性チェックのための行の完全なテキスト
    isCompleted: boolean;
}
```

## 5. 組み込み方針と影響範囲
既存のMarkdownパース処理やエディタのコアロジックには介入せず、独立したモジュールとして実装する。
エディタで対象ファイルが開かれていた場合の競合解決策として、Tauriイベントを介したファイルの再読み込み通知を利用する。
