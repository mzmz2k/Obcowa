<!-- --- START OF src/components/Editor.svelte --- -->
<script lang="ts">
    import { openTabs, activeTabId, currentWorkspaceIndex, openFileInNewTab, switchTab, closeTab, editorFont } from '$lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { tick } from 'svelte';
    import { Inbox } from 'lucide-svelte';
    
    // 💥 独立させた子部品たちをインポート
    import EditorHeader from './EditorHeader.svelte';
    import TabBar from './TabBar.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import EditorSearch from './EditorSearch.svelte';
    import { resetImageCache } from '../../lib/editor/imageViewer';
    import { imageFolderPath } from '../../lib/stores';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

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
                <EditorSearch />
            {:else}
                
                <EditorHeader {activeTab} {toggleEditMode} />

                {#if activeTab.isEditing}
                    <textarea bind:this={editArea} class="flex-1 w-full bg-transparent resize-none focus:outline-none p-6 overflow-y-auto" style="font-family: var(--editor-font, {$editorFont}); font-size: var(--editor-font-size, 14px); line-height: var(--editor-line-height, 1.6); color: var(--text-color);" value={activeTab.content} on:input={handleInput}></textarea>
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