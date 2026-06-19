<script lang="ts">
    import { openTabs, activeTabId, createNewTab, closeTab } from '$lib/stores';
    import { convertFileSrc } from '@tauri-apps/api/core';
    import { marked } from 'marked';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    function parseObsidianImages(content: string) {
        return content.replace(/!\[\[(.*?)\]\]/g, (match, filename) => {
            const mockAbsPath = `/path/to/vault/images/${filename}`;
            const assetUrl = convertFileSrc(mockAbsPath);
            return `<img src="${assetUrl}" alt="${filename}" class="max-w-full h-auto rounded" />`;
        });
    }

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
        <!-- 💥 relative を外し、flex-col を使って構造を整理 -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-gray-800 flex flex-col">
            
            <!-- 💥 右上に配置されるが、スクロールと共に上に流れていくボタン -->
            <div class="flex justify-end mb-4 shrink-0">
                <button 
                    class="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded shadow border border-gray-600 hover:bg-gray-600 hover:text-white transition"
                    on:click={toggleEditMode}
                >
                    {activeTab.isEditing ? '👀 プレビュー' : '✏️ 編集'}
                </button>
            </div>

            {#if activeTab.isEditing}
                <!-- 編集モード（このテキストエリア自体が画面の残り高さを埋める） -->
                <textarea 
                    class="flex-1 w-full bg-transparent text-gray-200 resize-none focus:outline-none font-mono text-sm min-h-[400px]"
                    value={activeTab.content}
                    on:input={handleInput}
                ></textarea>
            {:else}
                <!-- プレビューモード -->
                <div class="prose prose-invert max-w-none">
                    {@html renderedHtml}
                </div>
            {/if}
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