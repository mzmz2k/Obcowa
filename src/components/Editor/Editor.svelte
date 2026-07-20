<!-- --- START OF src/components/Editor.svelte --- -->
<script lang="ts">
    import { openTabs, activeTabId, currentWorkspaceIndex, openFileInNewTab, switchTab, closeTab, editorFont } from '$lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'; 
    import { tick } from 'svelte';
    import { Inbox } from 'lucide-svelte';
    
    // 💥 独立させた子部品たちをインポート
    import EditorHeader from './EditorHeader.svelte';
    import TabBar from './TabBar.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import EditorSearch from './EditorSearch.svelte';
    import { imageFolderPath } from '../../lib/stores';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // --- タブと保存の管理 ---
    let saveTimeout: ReturnType<typeof setTimeout>;
    let previewScrollContainer: HTMLDivElement | undefined;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

        // タブが開かれた時に、ファイルの最新日時を取得する
    $: if (activeTab && activeTab.path && activeTab.path !== '__SEARCH__' && activeTab.lastModified === 0) {
        invoke('get_file_modified', { path: activeTab.path }).then((modified) => {
            openTabs.update(tabs => {
                const t = tabs.find(t => t.id === activeTab!.id);
                if (t) t.lastModified = modified as number;
                return tabs;
            });
        }).catch(() => {});
    }

   // 保存時に競合チェックを行い、エラーならダイアログを出す
    async function saveCurrentTab() {
        if (activeTab && activeTab.isDirty && activeTab.path && activeTab.path !== '__SEARCH__') {
            try {
                // lastModifiedを渡し、force=false で保存を試みる
                const newModified = await invoke('save_file_content', { 
                    path: activeTab.path, 
                    content: activeTab.content,
                    lastModified: activeTab.lastModified || 0,
                    force: false
                });
                openTabs.update(tabs => { 
                    const t = tabs.find(t => t.id === activeTab!.id); 
                    if (t) { t.isDirty = false; t.lastModified = newModified as number; } 
                    return tabs; 
                });
            } catch (e) {
                if (e === "CONFLICT") {
                    const yes = await tauriConfirm("このファイルは他のアプリ（Obsidian等）によって外部で変更されています。上書き保存してよろしいですか？\n（キャンセルすると保存されません）", { title: "競合の確認", kind: "warning" });
                    if (yes) {
                        // 強制上書き (force=true)
                        const newModified = await invoke('save_file_content', { path: activeTab.path, content: activeTab.content, lastModified: activeTab.lastModified || 0, force: true });
                        openTabs.update(tabs => { const t = tabs.find(t => t.id === activeTab!.id); if (t) { t.isDirty = false; t.lastModified = newModified as number; } return tabs; });
                    } else {
                        // 保存をあきらめる（Dirty状態を維持するかはお好みで。今回はそのまま）
                    }
                }
            }
        }
    }

    async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
        await saveCurrentTab();
        const nextTab = $openTabs.find(t => t.id === tabId);

        scrollRatio = 0; // 別のタブを開いた時に前回のスクロール位置を引き継がないようリセットする

        switchTab(tabId);
    }

   async function handleTabClose(tabId: string) {
        const tab = $openTabs.find(t => t.id === tabId);
        if (tab && tab.isDirty && tab.path && tab.path !== '__SEARCH__') {
            try { 
                // まず通常通り (force: false) で保存を試みる
                await invoke('save_file_content', { 
                    path: tab.path, 
                    content: tab.content, 
                    lastModified: tab.lastModified || 0, 
                    force: false 
                }); 
            } catch (e) {
                if (e === "CONFLICT") {
                    // 💥 競合した場合は警告を出す
                    const yes = await tauriConfirm(
                        "このファイルは他のアプリによって外部で変更されています。\nあなたの編集内容で上書き保存してタブを閉じますか？\n（キャンセルすると保存せず、タブも開いたままにします）", 
                        { title: "競合の確認", kind: "warning" }
                    );
                    if (yes) {
                        // 「はい」を選んだら強制上書き
                        try { await invoke('save_file_content', { path: tab.path, content: tab.content, lastModified: tab.lastModified || 0, force: true }); } catch (e) {}
                    } else {
                        // 💥 「キャンセル」を選んだらここで処理を中断し、タブを閉じない
                        return;
                    }
                }
            }
        }
        // 競合がなかった場合、または上書きに同意した場合のみタブを閉じる
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

         // プレビュー側はイベントで処理するため、ここは編集エリア（textarea）のみにする
        if (activeTab.isEditing && editArea) {
            editArea.scrollTop = scrollRatio * editArea.scrollHeight;
        }
    }
    // プレビュー画面のHTML描画が終わった合図を受け取って実行される関数
    function handlePreviewRendered() {
        if (!activeTab?.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = scrollRatio * previewScrollContainer.scrollHeight;
        }
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
                    <EditorPreview {activeTab} bind:scrollContainer={previewScrollContainer} on:renderComplete={handlePreviewRendered} />
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