<script lang="ts">
    import { openTabs, activeTabId, createNewTab, closeTab, switchTab, editorFont, currentWorkspaceIndex, openFileInNewTab } from '$lib/stores';
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
            // --- 編集モードを終了して保存する処理 ---
            try {
                await invoke('save_file_content', { path: activeTab.path, content: activeTab.content });
                activeTab.isDirty = false;
            } catch (e) {
                console.error("保存失敗:", e);
                alert("ファイルの保存に失敗しました");
            }
        } else if (!activeTab.isEditing && activeTab.path && activeTab.path !== '__SEARCH__') {
            // 💥 変更: これから編集モードに入る時、最新のファイル内容を読み直す
            try {
                const bytes: number[] = await invoke('read_file_content', { path: activeTab.path });
                const uint8Array = new Uint8Array(bytes);
                let latestContent = "";
                try {
                    latestContent = new TextDecoder('utf-8', { fatal: true }).decode(uint8Array);
                } catch (e) {
                    latestContent = new TextDecoder('shift-jis').decode(uint8Array);
                }
                // アクティブタブの中身を最新のデータで上書きする
                activeTab.content = latestContent; 
            } catch(e) {
                console.error("最新状態の読み込み失敗:", e);
            }
        }

        openTabs.update(tabs => {
            const tab = tabs.find(t => t.id === activeTab!.id);
            if (tab) {
                // 💥 最新の content をストアにも反映させる
                if (!tab.isEditing) tab.content = activeTab!.content;
                tab.isEditing = !tab.isEditing;
            }
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

        // 💥 追加: 検索用の状態管理
    let searchQuery = '';
    let includeLibrary = false;
    let searchResults: any[] = [];
    let isSearching = false;
    let hasSearched = false;

    // 💥 追加: 検索実行処理
    async function executeSearch() {
        if (!searchQuery.trim()) return;
        isSearching = true;
        hasSearched = true;
        try {
            searchResults = await invoke('search_files', {
                workspaceIndex: $currentWorkspaceIndex,
                includeLibrary,
                query: searchQuery
            });
        } catch (e) {
            alert("検索に失敗しました: " + e);
        } finally {
            isSearching = false;
        }
    }

    // 💥 追加: 検索結果をクリックして新規タブで開く
    async function handleResultClick(path: string, name: string, forceNewTab: boolean = false) {
        // 右クリック（強制新規）でなく、かつ既に開いているタブがあればそれに切り替える
        if (!forceNewTab) {
            const existingTab = $openTabs.find(t => t.path === path);
            if (existingTab) {
                switchTab(existingTab.id);
                return; // ここで処理終了
            }
        }

        try {
            const bytes: number[] = await invoke('read_file_content', { path });
            const uint8Array = new Uint8Array(bytes);
            let content = "";
            try {
                content = new TextDecoder('utf-8', { fatal: true }).decode(uint8Array);
            } catch (e) {
                content = new TextDecoder('shift-jis').decode(uint8Array);
            }
            
            openFileInNewTab(path, name, content);
        } catch(e) {
            console.error("ファイル読み込み失敗:", e);
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
            
            <!-- 💥 検索タブだった場合の UI -->
            {#if activeTab.path === '__SEARCH__'}
                <div class="p-8 flex flex-col h-full text-gray-200">
                    <h2 class="text-xl font-bold mb-4">ファイル検索</h2>
                    <div class="flex gap-4 items-center mb-6">
                        <input type="text" bind:value={searchQuery} on:keydown={(e) => e.key === 'Enter' && executeSearch()} class="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm outline-none" placeholder="検索キーワードを入力... (Enterで検索)">
                        <label class="flex items-center text-sm cursor-pointer select-none">
                            <input type="checkbox" bind:checked={includeLibrary} class="mr-2"> ライブラリを含める
                        </label>
                        <button on:click={executeSearch} disabled={isSearching} class="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-sm font-bold transition">検索</button>
                    </div>
                    
                   <div class="flex-1 overflow-y-auto pr-2">
                        {#if isSearching}
                            <div class="text-gray-400 text-center py-10">検索中...</div>
                        {:else}
                            {#each searchResults as res}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <!-- 💥 変更: on:click と on:contextmenu(右クリック) を設定 -->
                                <div 
                                    class="py-1.5 px-2 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700 transition" 
                                    on:click={() => handleResultClick(res.path, res.name, false)}
                                    on:contextmenu|preventDefault={() => handleResultClick(res.path, res.name, true)}
                                >
                                    <div class="font-bold text-sm text-blue-300">📄 {res.name}</div>
                                    <div class="text-xs text-gray-400 truncate">{res.snippet}</div>
                                </div>
                            {/each}
                            {#if searchResults.length === 0 && hasSearched}
                                <div class="text-gray-500 text-center py-10">見つかりませんでした</div>
                            {/if}
                        {/if}
                    </div>
                </div>
            {:else}
                <!-- 検索タブ以外（通常のエディタ）でのみ表示するボタン -->
                <button 
                    class="absolute top-4 right-6 z-10 px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded shadow border border-gray-600 hover:bg-gray-600 hover:text-white transition opacity-60 hover:opacity-100"
                    on:click={toggleEditMode}
                >
                    {activeTab.isEditing ? '📖' : '✏️'}
                </button>

                <!-- 💥 変更: 不要な親枠 <div> をなくし、直接 if 文で切り替える -->
                {#if activeTab.isEditing}
                    <textarea 
                        bind:this={editArea}
                        class="flex-1 w-full bg-transparent text-gray-200 resize-none focus:outline-none text-sm p-6 overflow-y-auto"
                        style="font-family: {$editorFont};"
                        value={activeTab.content}
                        on:input={handleInput}
                    ></textarea>
                {:else}
                    <div 
                        class="flex-1 overflow-y-auto p-6" 
                        bind:this={previewScrollContainer} 
                        style="font-family: {$editorFont};"
                    >
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-static-element-interactions -->
                        <div class="prose prose-invert max-w-none select-text cursor-text" on:click={handlePreviewClick}>
                            {@html renderedHtml}
                        </div>
                    </div>
                {/if}

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