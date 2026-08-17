# プレビュー表示拡張機能 設計書

## 1. 概要
ビューモード（Markdownプレビュー）において、インタラクティブな機能（タスクリストのチェック＆ハイライト、コードブロックのコピー、見出しの折りたたみ）を提供する。

## 2. 実装方針

### A. モジュール構成
処理ロジックを `src/features/previewExtensions/previewExtensions.ts` に集約し、`EditorPreview.svelte` はDOM表示とイベント受け取りに専念させる。

src/
├── features/
│ └── previewExtensions/
│ ├── previewExtensions.ts # タスク置換・コピー・折りたたみロジック全般
│ └── previewExtensions.test.ts # 単体テスト(Vitest)
├── components/
│ └── Editor/
│ └── EditorPreview.svelte # marked拡張・DOMPurify設定・イベント委譲ハンドラ
└── app.css # CSS変数に準拠したテーマ対応スタイル

### B. 機能別仕様

#### 1. タスクリストのチェック＆ハイライト
- `marked` のリストアイテムレンダラーで、タスクチェックボックスに `data-task-index` 属性を付与。
- チェックボックスをクリックすると、`toggleTaskMarkdown` 関数により Markdown 本文の対応する箇所の `[ ]` と `[x]` を切り替えて保存。
- チェック済みのタスク（`li:has(input:checked)`）には `var(--active-highlight-bg)` の背景色を適用。

#### 2. コードブロックのコピーボタン
- `marked` の `renderer.code` をカスタマイズし、コードブロック右上（`<pre>` の直前または内部）にコピーボタン（`.code-copy-btn`）を挿入。
- クリック時に `navigator.clipboard.writeText()` でコード文字列をコピー。

#### 3. 見出しの折りたたみ（Collapsible Headings）
- `marked` の `renderer.heading` で見出しの左側に折りたたみ用アイコン（`.heading-toggle`）を挿入。
- クリック時に `toggleHeadingCollapse` 関数を呼び出し、同一レベル以上の見出しに達するまでの直後の要素群に対して表示/非表示（CSSの非表示クラス `is-collapsed`）をトグル。

### C. イベント委譲（Event Delegation）
パフォーマンス向上のため、`EditorPreview.svelte` の単一の `click` イベントハンドラで全ての操作を検知・分岐する。

```typescript
// EditorPreview.svelte 内のイベント委譲イメージ
async function handlePreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // 1. タスクチェックボックスのクリック
    const taskInput = target.closest<HTMLInputElement>('.task-checkbox');
    if (taskInput) { ... return; }

    // 2. コードコピーボタンのクリック
    const copyBtn = target.closest<HTMLButtonElement>('.code-copy-btn');
    if (copyBtn) { ... return; }

    // 3. 見出しトグルのクリック
    const headingToggle = target.closest<HTMLElement>('.heading-toggle');
    if (headingToggle) { ... return; }

    // 4. 既存の外部リンク開く処理
    const anchor = target.closest('a');
    if (anchor && anchor.href) { ... }
}
