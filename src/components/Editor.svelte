<script lang="ts">
    import { openTabs, activeTabId } from '$lib/stores';
    import { convertFileSrc } from '@tauri-apps/api/core';
    import { marked } from 'marked'; // 軽量なMarkdownパーサー

    // 現在アクティブなタブのデータを取得
    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // 💡 提案：Obsidianの画像パス `![[image.png]]` をTauriのローカルパスに変換
    function parseObsidianImages(content: string) {
        // ※実際には、Rust側でファイル名から絶対パスを検索する処理と連携します
        // ここでは仮定として、特定のフォルダ内の画像として変換します
        return content.replace(/!\[\[(.*?)\]\]/g, (match, filename) => {
            // Tauriの asset:// プロトコルを使ってローカル画像を直接読み込む
            // (WebViewがメモリ管理をしてくれるため高速です)
            const mockAbsPath = `/path/to/vault/images/${filename}`;
            const assetUrl = convertFileSrc(mockAbsPath);
            return `<img src="${assetUrl}" alt="${filename}" class="max-w-full h-auto rounded" />`;
        });
    }

    // MarkdownをHTMLに変換（画像パス変換も適用）
    $: renderedHtml = activeTab 
        ? marked(parseObsidianImages(activeTab.content)) 
        : '';

    function toggleEditMode() {
        if (!activeTab) return;
        openTabs.update(tabs => {
            const tab = tabs.find(t => t.id === activeTab!.id);
            if (tab) tab.isEditing = !tab.isEditing;
            return tabs;
        });
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;
        openTabs.update(tabs => {
            const tab = tabs.find(t => t.id === activeTab!.id);
            if (tab) {
                tab.content = target.value;
                tab.isDirty = true;
            }
            return tabs;
        });
    }
</script>

<div class="h-full flex flex-col bg-white">
    {#if activeTab}
        <!-- ヘッダーエリア（タイトルと切替ボタン） -->
        <div class="flex justify-between items-center p-2 border-b bg-gray-50">
            <h2 class="text-lg font-bold text-gray-700">{activeTab.title}</h2>
            <button 
                class="px-4 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                on:click={toggleEditMode}
            >
                {activeTab.isEditing ? 'プレビュー' : '編集'}
            </button>
        </div>

        <!-- エディタ / プレビュー エリア -->
        <div class="flex-1 overflow-auto p-4">
            {#if activeTab.isEditing}
                <textarea 
                    class="w-full h-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono text-sm"
                    value={activeTab.content}
                    on:input={handleInput}
                ></textarea>
            {:else}
                <div class="prose max-w-none">
                    <!-- HTMLを直接描画 (@html) -->
                    {@html renderedHtml}
                </div>
            {/if}
        </div>
    {:else}
        <div class="flex-1 flex items-center justify-center text-gray-400">
            ファイルを選択してください
        </div>
    {/if}
</div>