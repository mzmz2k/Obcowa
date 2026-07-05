<script lang="ts">
    import { openTabs, activeTabId, createNewTab, closeTab, switchTab, editorFont, currentWorkspaceIndex, openFileInNewTab, registeredTags, imageFolderPath } from '$lib/stores';
    import { invoke, convertFileSrc } from '@tauri-apps/api/core';
    import { openUrl } from '@tauri-apps/plugin-opener';
    import { marked } from 'marked';
    import { tick } from 'svelte';
    import { Search, FileText, Inbox, Tag, ChevronLeft, ChevronRight, Plus, X } from 'lucide-svelte';
    import EditorHeader from './EditorHeader.svelte';
    import { activeTheme } from '../lib/theme';
    import { generateImageHtml, resetImageCache, loadImagesInDom } from '../lib/imageViewer';

     marked.use({ breaks: true });

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

// 💥冒頭のプロパティ（Frontmatter）を削除する関数
function removeFrontmatter(content: string) {
        return content.replace(/^---\n[\s\S]*?\n---\n/, '');
    }

    function parseObsidianImages(content: string, tabPath: string) {
        return content.replace(/!\[\[(.*?)\]\]/g, (match, filename) => {
            // 💥 変更: ストアから画像フォルダのパスを取得して渡す ($imageFolderPath)
            return generateImageHtml(filename, tabPath, $imageFolderPath);
        });
    }

    $: renderedHtml = (() => {
        if (!activeTab) return '';
        
        let htmlStr = '';
        if (activeTab.path.endsWith('.txt')) {
            const safeText = activeTab.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            htmlStr = safeText.replace(/\n/g, '<br>');
        } else {
            htmlStr = marked(parseObsidianImages(removeFrontmatter(activeTab.content), activeTab.path));
        }

        // tick() は Svelteが「画面を最新に更新し終わった瞬間」を待つ命令です
        tick().then(() => {
            // 画面の更新が終わったら、画像を読み込む関数を実行
            loadImagesInDom();
        });

        return htmlStr;
    })();

        // 💥 アクティブなタブを保存する共通関数
    async function saveCurrentTab() {
        if (activeTab && activeTab.isDirty && activeTab.path && activeTab.path !== '__SEARCH__') {
            try {
                await invoke('save_file_content', { path: activeTab.path, content: activeTab.content });
                openTabs.update(tabs => {
                    const tab = tabs.find(t => t.id === activeTab!.id);
                    if (tab) tab.isDirty = false;
                    return tabs;
                });
            } catch (e) {
                console.error("保存失敗:", e);
            }
        }
    }

async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
        await saveCurrentTab();
        
        const nextTab = $openTabs.find(t => t.id === tabId);
        if (nextTab && nextTab.path) {
            // 💥 変更: ここにも $imageFolderPath を渡す
            resetImageCache(nextTab.path, $imageFolderPath);
        }

        switchTab(tabId);
    }

    // 💥 タブを閉じる時に未保存なら保存して閉じる
    async function handleTabClose(tabId: string) {
        const tab = $openTabs.find(t => t.id === tabId);
        if (tab && tab.isDirty && tab.path && tab.path !== '__SEARCH__') {
            try { await invoke('save_file_content', { path: tab.path, content: tab.content }); } catch (e) {}
        }
        closeTab(tabId);
    }

      // 💥 タブの右クリックメニュー用
    let tabMenu = { show: false, x: 0, y: 0, tabId: '', path: '', title: '', content: '', tags: [] as string[], openSubLeft: false };

    function handleTabContextMenu(e: MouseEvent, tab: any) {
        e.preventDefault();

        // 💥  メニューが画面外にはみ出ないようにX座標を調整
        // 親メニューの幅(約200px)が画面右端を超える場合は左にズラす
        let adjustedX = e.clientX;
        if (adjustedX + 200 > window.innerWidth) {
            adjustedX = window.innerWidth - 200;
        }

        // さらにサブメニュー(約150px)を展開するスペースが右側にあるか判定
        const openSubLeft = (adjustedX + 200 + 150) > window.innerWidth;

        tabMenu = {
            show: true,
            x: adjustedX, // 補正したX座標を使う
            y: e.clientY,
            tabId: tab.id,
            path: tab.path,
            title: tab.title,
            content: tab.content,
            tags: extractTags(tab.content),
            openSubLeft // 判定結果を保存
        };
    }

    function closeTabMenu() {
        tabMenu.show = false;
    }

    // 💥  タグ抽出関数（タブ上の未保存データから拾うため）
    function extractTags(content: string) {
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const tags: string[] = [];
        if (match) {
            const lines = match[1].split(/\r?\n/);
            let inTags = false;
            for (const line of lines) {
                if (line.startsWith('tags:') || line.startsWith('tag:')) {
                    inTags = true;
                    const inlineStr = line.substring(line.indexOf(':') + 1).trim();
                    if (inlineStr) {
                        tags.push(...inlineStr.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(t => t));
                        inTags = false; 
                    }
                    continue;
                }
                if (inTags) {
                    if (line.trim().startsWith('- ')) {
                        tags.push(line.trim().substring(2).trim());
                    } else if (line.trim() !== '' && !line.startsWith(' ')) {
                        inTags = false;
                    }
                }
            }
        }
        return [...new Set(tags)];
    }

    // 💥  タブ上でタグを書き込み、即座に保存する関数
    async function operateTagForTab(tag: string, isAdd: boolean) {
        if (!tabMenu.path) { closeTabMenu(); return; }
        
        const tab = $openTabs.find(t => t.id === tabMenu.tabId);
        if (!tab) { closeTabMenu(); return; }
        
        let content = tab.content;
        let tags = extractTags(content);
        
        if (isAdd) {
            if (tags.includes(tag)) { closeTabMenu(); return; }
            tags.push(tag);
        } else {
            if (!tags.includes(tag)) { closeTabMenu(); return; }
            tags = tags.filter(t => t !== tag);
        }

        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
            let fm = match[1];
            let newFmLines: string[] = [];
            const lines = fm.split(/\r?\n/);
            let inTagsBlock = false;
            let hasTags = false;

            for (const line of lines) {
                if (line.startsWith('tags:') || line.startsWith('tag:')) {
                    inTagsBlock = true;
                    hasTags = true;
                    if (tags.length > 0) {
                        newFmLines.push(`tags:`);
                        tags.forEach(t => newFmLines.push(`  - ${t}`));
                    }
                    continue;
                }
                if (inTagsBlock) {
                    if (line.trim().startsWith('- ') || line.trim() === '') {
                        continue;
                    } else if (!line.startsWith(' ') && line.includes(':')) {
                        inTagsBlock = false; 
                    }
                }
                if (!inTagsBlock) newFmLines.push(line);
            }
            if (!hasTags && tags.length > 0) {
                newFmLines.push(`tags:`);
                tags.forEach(t => newFmLines.push(`  - ${t}`));
            }
            content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFmLines.join('\n')}\n---`);
        } else {
            if (tags.length > 0) {
                let tagsYaml = `tags:\n` + tags.map(t => `  - ${t}`).join('\n');
                content = `---\n${tagsYaml}\n---\n\n${content}`;
            }
        }

        try {
            await invoke('save_file_content', { path: tabMenu.path, content });
            openTabs.update(tabs => {
                const t = tabs.find(t => t.id === tabMenu.tabId);
                if (t) {
                    t.content = content;
                    t.isDirty = false;
                }
                return tabs;
            });
        } catch(err) {
            alert("タグの保存に失敗しました");
        }
        closeTabMenu();
    }

     // 💥 スクロール位置の記憶用
    let previewScrollContainer: HTMLDivElement;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

   async function toggleEditMode() {
        if (!activeTab) return;
        
        // 切り替え前に現在のスクロール位置の「割合」を記録
        if (activeTab.isEditing && editArea) {
            scrollRatio = editArea.scrollTop / editArea.scrollHeight;
        } else if (!activeTab.isEditing && previewScrollContainer) {
            scrollRatio = previewScrollContainer.scrollTop / previewScrollContainer.scrollHeight;
        }

        if (activeTab.isEditing && activeTab.path) {
            // 💥 変更: 共通の保存関数を使用
            await saveCurrentTab();

        // 💥 変更: 条件に `!activeTab.isDirty` を追加し、未保存のデータがある場合は古いファイルでの上書きを防ぐ
        } else if (!activeTab.isEditing && activeTab.path && activeTab.path !== '__SEARCH__' && !activeTab.isDirty) {
            try {
                const bytes: number[] = await invoke('read_file_content', { path: activeTab.path });
                const uint8Array = new Uint8Array(bytes);
                let latestContent = "";
                try { latestContent = new TextDecoder('utf-8', { fatal: true }).decode(uint8Array); } 
                catch (e) { latestContent = new TextDecoder('shift-jis').decode(uint8Array); }
                activeTab.content = latestContent; 
            } catch(e) {
                console.error("最新状態の読み込み失敗:", e);
            }
        }

        openTabs.update(tabs => {
            const tab = tabs.find(t => t.id === activeTab!.id);
            if (tab) {
                if (!tab.isEditing) tab.content = activeTab!.content;
                tab.isEditing = !tab.isEditing;
            }
            return tabs;
        });

        await tick();
        if (activeTab.isEditing && editArea) {
            editArea.scrollTop = scrollRatio * editArea.scrollHeight;
        } else if (!activeTab.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = scrollRatio * previewScrollContainer.scrollHeight;
        }
    }

       // 💥  自動保存タイマー
    let saveTimeout: ReturnType<typeof setTimeout>;

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

        // 💥  1.5秒間入力が止まったら自動保存
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveCurrentTab();
        }, 1500);
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

        // 💥  検索用の状態管理
    let searchQuery = '';
    let includeLibrary = false;
    let searchResults: any[] = [];
    let isSearching = false;
    let hasSearched = false;

    // 💥  検索実行処理
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

    // 💥  検索結果をクリックして新規タブで開く
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

<svelte:window on:click={closeTabMenu} />

<div class="h-full flex flex-col transition-colors duration-200" style="background-color: var(--bg-color); color: var(--text-color);">
    
    <!-- タブバーエリア -->
    <div class="flex border-b border-black/10 flex-wrap select-none" style="background-color: var(--menu-bg);">
        {#each $openTabs as tab}
            <div 
                class="flex items-center px-2 py-1 text-xs max-w-[120px] cursor-pointer border-r border-black/10 border-b transition-colors
                       { $activeTabId === tab.id ? 'border-t-2' : 'border-t-2 border-t-transparent hover:opacity-70' }"
                style="{ $activeTabId === tab.id ? 'background-color: var(--bg-color); color: var(--text-color); border-top-color: var(--accent-color); border-bottom-color: transparent;' : 'background-color: transparent; color: inherit;' }"
                on:click={() => handleTabClick(tab.id)}
                on:contextmenu={(e) => handleTabContextMenu(e, tab)}
            >
                {#if tab.path === '__SEARCH__'}
                    <Search size={14} class="mr-1.5 opacity-70 shrink-0" />
                {/if}
                <span class="truncate flex-1" title={tab.title}>{tab.title}</span>
                
                {#if tab.isDirty}
                    <span class="ml-1 text-[10px]" style="color: var(--accent-color);">●</span>
                {/if}

                <button 
                    class="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 hover:text-red-400 transition"
                    on:click|stopPropagation={() => handleTabClose(tab.id)}
                >
                    <X size={12} />
                </button>
            </div>
        {/each}
        
        <button 
            class="px-3 py-1 flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 transition"
            title="新しいタブを開く"
            on:click={createNewTab}
        >
            <Plus size={16} />
        </button>
    </div>

    <!-- エディタ / プレビュー エリア -->
    {#if activeTab}
        <div class="flex-1 relative flex flex-col overflow-hidden" style="background-color: var(--bg-color);">
            
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
                                    <div class="flex items-center font-bold text-sm text-blue-300"><FileText size={14} class="mr-1" /> {res.name}</div>
                                    <div class="text-xs text-gray-400 truncate mt-1">{res.snippet}</div>
                                </div>
                            {/each}
                            {#if searchResults.length === 0 && hasSearched}
                                <div class="text-gray-500 text-center py-10">見つかりませんでした</div>
                            {/if}
                        {/if}
                    </div>
                </div>
            {:else}
                <EditorHeader {activeTab} {toggleEditMode} />

                {#if activeTab.isEditing}
                    <textarea 
                        bind:this={editArea}
                        class="flex-1 w-full bg-transparent resize-none focus:outline-none text-sm p-6 overflow-y-auto"
                        style="font-family: {$editorFont}; color: var(--text-color);"
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
                        <div class="prose max-w-none select-text cursor-text editor-preview" style="color: var(--text-color);" on:click={handlePreviewClick}>
                            {@html renderedHtml}
                        </div>
                    </div>
                {/if}

            {/if}
            
        </div>
    {:else}

        <div class="flex-1 flex flex-col items-center justify-center opacity-60" style="background-color: var(--bg-color);">
            <Inbox size={48} class="mb-4" />
            <div class="text-sm">ファイルを選択するか、＋ボタンで新規作成してください</div>
        </div>
    {/if}
</div>

<!-- 💥  タブの右クリックメニュー -->
{#if tabMenu.show}
    <div 
      class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-48"
      style="left: {tabMenu.x}px; top: {tabMenu.y}px; background-color: var(--menu-bg); color: var(--text-color);"
    >
        {#if tabMenu.path && tabMenu.path !== '__SEARCH__'}
            <button 
                class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition"
                on:click={() => {
                    openFileInNewTab(tabMenu.path, tabMenu.title, tabMenu.content);
                    closeTabMenu();
                }}
            >
                新しいタブで開く
            </button>

            <hr class="border-gray-700 my-1">

            <!-- タグを挿入 -->
             <div class="relative group/tagadd">
                 <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
                    <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを挿入</span>
                    <span>{#if tabMenu.openSubLeft}<ChevronLeft size={14} />{:else}<ChevronRight size={14} />{/if}</span>
                </button>
                <div class="absolute {tabMenu.openSubLeft ? 'right-full -mr-1' : 'left-full -ml-1'} top-0 hidden group-hover/tagadd:block border border-black/20 rounded shadow-xl py-1 w-36" style="background-color: var(--menu-bg);">
                    {#each $registeredTags as tag}
                        <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 truncate" on:click={() => operateTagForTab(tag, true)}>{tag}</button>
                    {:else}<div class="px-4 py-1.5 text-sm opacity-50">タグ未登録</div>{/each}
                </div>
            </div>

            <!-- タグを削除 -->
            <div class="relative group/tagdel">
                <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
                    <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを削除</span>
                    <span>{#if tabMenu.openSubLeft}<ChevronLeft size={14} />{:else}<ChevronRight size={14} />{/if}</span>
                </button>
                <div class="absolute {tabMenu.openSubLeft ? 'right-full -mr-1' : 'left-full -ml-1'} top-0 hidden group-hover/tagdel:block border border-black/20 rounded shadow-xl py-1 w-36" style="background-color: var(--menu-bg);">
                    {#each tabMenu.tags as tag}
                        <button class="block w-full text-left px-4 py-1.5 text-sm text-red-400 hover:bg-black/10 truncate" on:click={() => operateTagForTab(tag, false)}><span class="inline-block w-4">✓</span>{tag}</button>
                    {:else}<div class="px-4 py-1.5 text-sm opacity-50">タグなし</div>{/each}
                </div>
            </div>
        {:else}
            <div class="px-4 py-2 text-sm opacity-50">操作できません</div>
        {/if}
    </div>
{/if}

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