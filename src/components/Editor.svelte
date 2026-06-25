<script lang="ts">
    import { openTabs, activeTabId, createNewTab, closeTab, switchTab, editorFont } from '$lib/stores';
    import { invoke, convertFileSrc } from '@tauri-apps/api/core';
    import { openUrl } from '@tauri-apps/plugin-opener';
    import { marked } from 'marked';
    import { tick } from 'svelte';

     marked.use({ breaks: true });

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

    $: renderedHtml = (() => {
        if (!activeTab) return '';
        
        // .txt ファイルの場合は Markdown 変換をスキップ
        if (activeTab.path.endsWith('.txt')) {
            // タグを無効化（サニタイズ）しつつ、改行を <br> にする
            const safeText = activeTab.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return safeText.replace(/\n/g, '<br>');
        }
        
        // .md などそれ以外は通常通り Markdown 変換
        return marked(parseObsidianImages(removeFrontmatter(activeTab.content)));
    })();

     // 💥 スクロール位置の記憶用
    let previewScrollContainer: HTMLDivElement;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

    async function toggleEditMode() {
        if (!activeTab) return;
        
        // 💥 切り替え前に現在のスクロール位置の「割合」を記録
        if (activeTab.isEditing && editArea) {
            scrollRatio = editArea.scrollTop / editArea.scrollHeight;
        } else if (!activeTab.isEditing && previewScrollContainer) {
            scrollRatio = previewScrollContainer.scrollTop / previewScrollContainer.scrollHeight;
        }

        if (activeTab.isEditing && activeTab.path) {
            try {
                await invoke('save_file_content', { path: activeTab.path, content: activeTab.content });
                activeTab.isDirty = false;
            } catch (e) {
                console.error("保存失敗:", e);
                alert("ファイルの保存に失敗しました");
            }
        }

        openTabs.update(tabs => {
            const tab = tabs.find(t => t.id === activeTab!.id);
            if (tab) tab.isEditing = !tab.isEditing;
            return tabs;
        });

        // 💥 DOMが切り替わった直後にスクロール位置を復元
        await tick();
        if (activeTab.isEditing && editArea) {
            editArea.scrollTop = scrollRatio * editArea.scrollHeight;
        } else if (!activeTab.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = scrollRatio * previewScrollContainer.scrollHeight;
        }
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

    async function handlePreviewClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a'); // クリックした要素が <a> タグの中か確認
        if (anchor && anchor.href) {
            event.preventDefault(); // WebView内での画面遷移を防ぐ
            try {
                await openUrl(anchor.href);
            } catch (e) {
                console.error("リンクを開けませんでした:", e);
            }
        }
    }

</script>

<div class="h-full flex flex-col bg-gray-900">
    
    <!-- 💥 タブバーエリア -->
<!-- 💥 タブバーエリア -->
    <!-- flex-wrap をつけて、溢れたら段を変えるようにしました -->
    <div class="flex bg-[#1e1e1e] border-b border-gray-700 flex-wrap select-none">
        {#each $openTabs as tab}
            <div 
                class="flex items-center px-2 py-1 text-xs max-w-[120px] cursor-pointer border-r border-gray-700 border-b border-b-gray-800 transition-colors
                       { $activeTabId === tab.id ? 'bg-gray-800 text-gray-200 border-t-2 border-t-blue-500' : 'bg-[#1e1e1e] text-gray-500 hover:bg-gray-800' }"
                on:click={() => switchTab(tab.id)} 
            >
                <span class="truncate flex-1" title={tab.title}>{tab.title}</span>
                <button 
                    class="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-600 hover:text-red-400 transition"
                    on:click|stopPropagation={() => closeTab(tab.id)}
                >
                    ×
                </button>
            </div>
        {/each}
        
        <button 
            class="px-3 py-1 text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition text-sm"
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
                {activeTab.isEditing ? '📖' : '✏️'}
            </button>

            <div class="flex-1 overflow-y-auto p-6" bind:this={previewScrollContainer} style="font-family: {$editorFont};">
                {#if activeTab.isEditing}
                    <!-- 💥 bind:this を追加 -->
                    <textarea 
                        bind:this={editArea}
                        class="w-full h-full bg-transparent text-gray-200 resize-none focus:outline-none text-sm min-h-[400px]"
                        value={activeTab.content}
                        on:input={handleInput}
                    ></textarea>
                {:else}
                    <!-- 💥 追加: リンククリックをインターセプトするためのイベントと warning 回避のコメントを追加 -->
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="prose prose-invert max-w-none select-text cursor-text" on:click={handlePreviewClick}>
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