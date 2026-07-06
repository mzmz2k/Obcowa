<!-- --- START OF src/components/Editor.svelte --- -->
<script lang="ts">
    import { openTabs, activeTabId, currentWorkspaceIndex, openFileInNewTab, switchTab, closeTab, editorFont } from '$lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { tick } from 'svelte';
    import { Search, FileText, Inbox } from 'lucide-svelte';
    
    // 💥 独立させた子部品たちをインポート
    import EditorHeader from './EditorHeader.svelte';
    import TabBar from './TabBar.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import { resetImageCache } from '../../lib/editor/imageViewer';
    import { imageFolderPath } from '../../lib/stores';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // --- 検索機能 ---
    let searchQuery = '';
    let includeLibrary = false;
    let searchResults: any[] = [];
    let isSearching = false;
    let hasSearched = false;

    async function executeSearch() {
        if (!searchQuery.trim()) return;
        isSearching = true; hasSearched = true;
        try { searchResults = await invoke('search_files', { workspaceIndex: $currentWorkspaceIndex, includeLibrary, query: searchQuery }); } 
        catch (e) { alert("検索に失敗しました: " + e); } 
        finally { isSearching = false; }
    }

    async function handleResultClick(path: string, name: string, forceNewTab: boolean = false) {
        if (!forceNewTab) {
            const existingTab = $openTabs.find(t => t.path === path);
            if (existingTab) { switchTab(existingTab.id); return; }
        }
        try {
            const bytes: number[] = await invoke('read_file_content', { path });
            let content = "";
            try { content = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } 
            catch (e) { content = new TextDecoder('shift-jis').decode(new Uint8Array(bytes)); }
            openFileInNewTab(path, name, content);
        } catch(e) {}
    }

    // --- タブと保存の管理 ---
    let saveTimeout: ReturnType<typeof setTimeout>;
    let previewScrollContainer: HTMLDivElement | undefined;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

    async function saveCurrentTab() {
        if (activeTab && activeTab.isDirty && activeTab.path && activeTab.path !== '__SEARCH__') {
            try {
                await invoke('save_file_content', { path: activeTab.path, content: activeTab.content });
                openTabs.update(tabs => { const t = tabs.find(t => t.id === activeTab!.id); if (t) t.isDirty = false; return tabs; });
            } catch (e) {}
        }
    }

    async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
        await saveCurrentTab();
        const nextTab = $openTabs.find(t => t.id === tabId);
        if (nextTab && nextTab.path) resetImageCache(nextTab.path, $imageFolderPath);
        switchTab(tabId);
    }

    async function handleTabClose(tabId: string) {
        const tab = $openTabs.find(t => t.id === tabId);
        if (tab && tab.isDirty && tab.path && tab.path !== '__SEARCH__') {
            try { await invoke('save_file_content', { path: tab.path, content: tab.content }); } catch (e) {}
        }
        closeTab(tabId);
    }

    async function toggleEditMode() {
        if (!activeTab) return;
        
        if (activeTab.isEditing && editArea) { scrollRatio = editArea.scrollTop / editArea.scrollHeight; } 
        else if (!activeTab.isEditing && previewScrollContainer) { scrollRatio = previewScrollContainer.scrollTop / previewScrollContainer.scrollHeight; }

        if (activeTab.isEditing && activeTab.path) { await saveCurrentTab(); } 
        else if (!activeTab.isEditing && activeTab.path && activeTab.path !== '__SEARCH__' && !activeTab.isDirty) {
            try {
                const bytes: number[] = await invoke('read_file_content', { path: activeTab.path });
                let latestContent = "";
                try { latestContent = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } 
                catch (e) { latestContent = new TextDecoder('shift-jis').decode(new Uint8Array(bytes)); }
                activeTab.content = latestContent; 
            } catch(e) {}
        }

        openTabs.update(tabs => { const t = tabs.find(t => t.id === activeTab!.id); if (t) { if (!t.isEditing) t.content = activeTab!.content; t.isEditing = !t.isEditing; } return tabs; });

        await tick();
        if (activeTab.isEditing && editArea) editArea.scrollTop = scrollRatio * editArea.scrollHeight;
        else if (!activeTab.isEditing && previewScrollContainer) previewScrollContainer.scrollTop = scrollRatio * previewScrollContainer.scrollHeight;
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;
        openTabs.update(tabs => { const t = tabs.find(t => t.id === activeTab!.id); if (t) { t.content = target.value; t.isDirty = true; } return tabs; });
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveCurrentTab(); }, 1500);
    }
</script>

<div class="h-full flex flex-col transition-colors duration-200" style="background-color: var(--bg-color); color: var(--text-color);">
    
    <!-- 💥 独立させたタブバーを配置 -->
    <TabBar {handleTabClick} {handleTabClose} />

    {#if activeTab}
        <div class="flex-1 relative flex flex-col overflow-hidden" style="background-color: var(--bg-color);">
            
            {#if activeTab.path === '__SEARCH__'}
                <div class="p-8 flex flex-col h-full text-gray-200">
                    <h2 class="text-xl font-bold mb-4" style="color: var(--text-color);">ファイル検索</h2>
                    <div class="flex gap-4 items-center mb-6">
                        <input type="text" bind:value={searchQuery} on:keydown={(e) => e.key === 'Enter' && executeSearch()} class="flex-1 border border-gray-600 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" placeholder="検索キーワードを入力... (Enterで検索)">
                        <label class="flex items-center text-sm cursor-pointer select-none"style="color: var(--text-color);">
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
                                <div class="py-1.5 px-2 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700 transition" on:click={() => handleResultClick(res.path, res.name, false)} on:contextmenu|preventDefault={() => handleResultClick(res.path, res.name, true)}>
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
                    <textarea bind:this={editArea} class="flex-1 w-full bg-transparent resize-none focus:outline-none text-sm p-6 overflow-y-auto" style="font-family: {$editorFont}; color: var(--text-color);" value={activeTab.content} on:input={handleInput}></textarea>
                {:else}
                    <!-- 💥 独立させたプレビュー画面を配置（スクロール位置を双方向に同期） -->
                    <EditorPreview {activeTab} bind:scrollContainer={previewScrollContainer} />
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
<!-- --- END OF src/components/Editor.svelte --- -->