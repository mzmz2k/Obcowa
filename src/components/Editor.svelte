<script lang="ts">
    import { openTabs, activeTabId, createNewTab, closeTab, editorFont } from '$lib/stores';
    import { convertFileSrc } from '@tauri-apps/api/core';
    import { marked } from 'marked';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // 💥 追加：冒頭のプロパティ（Frontmatter）を削除する関数
    function removeFrontmatter(content: string) {
        // 先頭が --- で始まり、次の --- が来るまでの間を消去する
        return content.replace(/^---\n[\s\S]*?\n---\n/, '');
    }

    function parseObsidianImages(content: string) {
        return content.replace(/!\[\[(.*?)\]\]/g, (match, filename) => {
            const mockAbsPath = `/path/to/vault/images/${filename}`;
            const assetUrl = convertFileSrc(mockAbsPath);
            return `<img src="${assetUrl}" alt="${filename}" class="max-w-full h-auto rounded" />`;
        });
    }

    $: renderedHtml = activeTab 
        ? marked(parseObsidianImages(removeFrontmatter(activeTab.content))) 
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

<div class="h-full flex flex-col bg-gray-900">
    
    <!-- 💥 タブバーエリア -->
    <div class="flex bg-[#1e1e1e] border-b border-gray-700 overflow-x-auto select-none no-scrollbar">
        {#each $openTabs as tab}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div 
                class="flex items-center px-3 py-1.5 text-sm max-w-[160px] cursor-pointer border-r border-gray-700 transition-colors
                       { $activeTabId === tab.id ? 'bg-gray-800 text-gray-200 border-t-2 border-t-blue-500' : 'bg-[#1e1e1e] text-gray-500 hover:bg-gray-800' }"
                on:click={() => activeTabId.set(tab.id)}
            >
                <!-- 💥 長い文字は truncate で ... に省略される -->
                <span class="truncate flex-1">{tab.title}</span>
                <button 
                    class="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-600 hover:text-red-400 transition"
                    on:click|stopPropagation={() => closeTab(tab.id)}
                >
                    ×
                </button>
            </div>
        {/each}
        
        <!-- 💥 タブ追加（＋）ボタン -->
        <button 
            class="px-4 py-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition"
            title="新しいタブを開く"
            on:click={createNewTab}
        >
            ＋
        </button>
    </div>

    <!-- エディタ / プレビュー エリア -->
    {#if activeTab}
        <div class="flex-1 relative bg-gray-800 flex flex-col overflow-hidden">
            
            <!-- 💥 常に右上に固定（absolute） -->
            <button 
                class="absolute top-4 right-6 z-10 px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded shadow border border-gray-600 hover:bg-gray-600 hover:text-white transition opacity-60 hover:opacity-100"
                on:click={toggleEditMode}
            >
                {activeTab.isEditing ? '👀 プレビュー' : '✏️ 編集'}
            </button>

            <div class="flex-1 overflow-y-auto p-6" style="font-family: {$editorFont};">
                {#if activeTab.isEditing}
                    <textarea 
                        class="w-full h-full bg-transparent text-gray-200 resize-none focus:outline-none text-sm min-h-[400px]"
                        value={activeTab.content}
                        on:input={handleInput}
                    ></textarea>
                {:else}
                    <div class="prose prose-invert max-w-none">
                        {@html renderedHtml}
                    </div>
                {/if}
            </div>
        </div>
    {:else}

        <div class="flex-1 flex flex-col items-center justify-center text-gray-600 bg-gray-800">
            <div class="text-4xl mb-4">🗂️</div>
            <div>ファイルを選択するか、＋ボタンで新規作成してください</div>
        </div>
    {/if}
</div>

<style>
    /* タブバーのスクロールバーを隠すための小技 */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>