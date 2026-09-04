<!-- エディタ画面を統括する親部品 -->

<!-- --- START OF src/components/Editor.svelte --- -->
<script lang="ts">
    import { openTabs, activeTabId, currentWorkspaceIndex, openFileInNewTab, switchTab, closeTab, editorFont, workspaces } from '$lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'; 
    import { tick } from 'svelte';
    import { Inbox } from 'lucide-svelte';
    
    import EditorHeader from './EditorHeader.svelte';
    import TabBar from './TabBar.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import EditorSearch from './EditorSearch.svelte';
    import { currentWorkspace } from '../../lib/stores';
    import { saveTabWithConflictCheck, type SaveDependencies } from '../../lib/editor/editorSave';
    import { calculateScrollRatio, calculateScrollTopFromRatio } from '../../lib/editor/scrollSync';
    import TaskList from '../../features/Task/TaskList.svelte';
    import { isSpecialPath } from '../../lib/utils/pathUtils';
    import ConflictDialog from '../Modals/ConflictDialog.svelte';

    $: activeTab = $openTabs.find(t => t.id === $activeTabId);

    // --- タブと保存の管理 ---
    let saveTimeout: ReturnType<typeof setTimeout>;
    let isDialogShowing = false; //  ダイアログの連続表示を防止するためのフラグ
    let previewScrollContainer: HTMLDivElement | undefined;
    let editArea: HTMLTextAreaElement;
    let scrollRatio = 0;

       // 💥 競合ダイアログ用の状態管理
   let conflictDialogOpen = false;
   let conflictFilePath = "";
   let conflictResolve: ((res: 'overwrite' | 'reload' | 'cancel') => void) | null = null;
 
   // ダイアログを開き、ユーザーの選択を待つPromiseを返す
   const askConflictResolution = (path: string): Promise<'overwrite' | 'reload' | 'cancel'> => {
       return new Promise((resolve) => {
           conflictFilePath = path;
           conflictDialogOpen = true;
           conflictResolve = (res) => {
               conflictDialogOpen = false;
               resolve(res);
           };
       });
   };

    const saveDeps: SaveDependencies = {
        saveFileContent: (path, content, lastModified, force) => invoke('save_file_content', { path, content, lastModified, force }),
        getModified: (path) => invoke('get_file_modified', { path }),
        readFileContent: (path) => invoke('read_file_content', { path }),
        askConflictResolution,
        saveDashboard: async (workspaceId, content) => {
            await invoke('save_dashboard', { workspaceId, content });
        }
    };


        // タブが開かれた時に、ファイルの最新日時を取得する
    $: if (activeTab && activeTab.path && !isSpecialPath(activeTab.path) && activeTab.lastModified === 0) {
        invoke('get_file_modified', { path: activeTab.path }).then((modified) => {
            openTabs.update(tabs => {
                const t = tabs.find(t => t.id === activeTab!.id);
                if (t) t.lastModified = modified as number;
                return tabs;
            });
        }).catch(() => {});
    }
   // 💥 連続保存による非同期のズレを防ぐためのロック用変数
   let savePromise: Promise<void> | null = null;

   // 保存時に競合チェックを行い、エラーならダイアログを出す
    async function saveCurrentTab() {
        if (isDialogShowing) return; 
        
        // 💥 別の保存処理が実行中の場合は完了を待つ（レースコンディション防止）
        if (savePromise) {
            await savePromise;
        }

        savePromise = (async () => {
            // 非同期待ちの間にタブが切り替わっている可能性があるため、Storeから最新の情報を取得する
            const currentId = $activeTabId;
            const targetTab = $openTabs.find(t => t.id === currentId);

            if (!targetTab) return;

            await saveTabWithConflictCheck(
                targetTab,
                saveDeps,
                (updater) => openTabs.update(tabs => tabs.map(t => t.id === targetTab.id ? updater(t) : t)),
                (showing) => { isDialogShowing = showing; }
            );
        })();

        await savePromise;
        savePromise = null;
    }

    async function handleTabClick(tabId: string) {
        clearTimeout(saveTimeout);
        await saveCurrentTab();
        const nextTab = $openTabs.find(t => t.id === tabId);

        scrollRatio = 0; // 別のタブを開いた時に前回のスクロール位置を引き継がないようリセットする

        switchTab(tabId);
    }

    async function handleTabClose(tabId: string) {
        if (isDialogShowing) return;
        
        // 他の保存が走っていれば待つ
        if (savePromise) await savePromise; 

        const tab = $openTabs.find(t => t.id === tabId);

        if (tab) {
            const saved = await saveTabWithConflictCheck(
                tab,
                saveDeps,
                (updater) => openTabs.update(tabs => tabs.map(t => t.id === tab.id ? updater(t) : t)),
                (showing) => { isDialogShowing = showing; }
            );
            if (!saved && tab.isConflict) return; // キャンセルされた場合は閉じない
        }
        closeTab(tabId);
    }

    async function toggleEditMode() {
        if (!activeTab) return;
        
        if (activeTab.isEditing && editArea) { 
            scrollRatio = calculateScrollRatio(editArea.scrollTop, editArea.scrollHeight); 
        } else if (!activeTab.isEditing && previewScrollContainer) { 
            scrollRatio = calculateScrollRatio(previewScrollContainer.scrollTop, previewScrollContainer.scrollHeight); 
        }

        if (activeTab.isEditing && activeTab.path) { await saveCurrentTab(); } 
        else if (!activeTab.isEditing && activeTab.path && !isSpecialPath(activeTab.path) && !activeTab.isDirty) {
            try {
                const latestContent: string = await invoke('read_file_content', { path: activeTab.path });
                activeTab.content = latestContent;
                
                // 💥 閲覧モードから編集モードに戻す/読み込む際にも最新の更新日時を取得する
                const modified = (await invoke('get_file_modified', { path: activeTab.path })) as number;
                activeTab.lastModified = modified;
            } catch(e) {}
        }

        openTabs.update(tabs => { const t = tabs.find(t => t.id === activeTab!.id); if (t) { if (!t.isEditing) t.content = activeTab!.content; t.isEditing = !t.isEditing; } return tabs; });

        await tick();

         // プレビュー側はイベントで処理するため、ここは編集エリア（textarea）のみにする
        if (activeTab.isEditing && editArea) {

            editArea.scrollTop = calculateScrollTopFromRatio(scrollRatio, editArea.scrollHeight);
        }
    }
    
    // プレビュー画面のHTML描画が終わった合図を受け取って実行される関数
    function handlePreviewRendered() {
        if (!activeTab?.isEditing && previewScrollContainer) {
            previewScrollContainer.scrollTop = calculateScrollTopFromRatio(scrollRatio, previewScrollContainer.scrollHeight);
        }
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        if (!activeTab) return;
        openTabs.update(tabs => { 
            const t = tabs.find(t => t.id === activeTab!.id); 
            if (t) { 
                t.content = target.value; 
                t.isDirty = true; 
                // 💥 入力があったら保留フラグを解除する
                t.isConflict = false; 
            } 
            return tabs; 
        });
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { 
            // 💥 現在のタブが保留(Conflict)状態でなければ保存を実行
            const current = $openTabs.find(t => t.id === activeTab!.id);
            if (!current?.isConflict) {
                saveCurrentTab(); 
            }
        }, 1500);
    }

    // 💥 プレビュー(ビューモード)でのコンテンツ変更（タスク切り替え等）を受け取って保存する関数
    function handlePreviewContentChange(event: CustomEvent<{ path: string; content: string }>) {
        if (!activeTab) return;
        const { content } = event.detail;
        
        openTabs.update(tabs => {
            return tabs.map(t => {
                if (t.id === activeTab!.id) {
                    return { ...t, content, isDirty: true, isConflict: false };
                }
                return t;
            });
        });

        // Editor.svelte 既存の競合チェック付き安全保存を実行
        saveCurrentTab();
    }

</script>

<div class="h-full flex flex-col transition-colors duration-200" style="background-color: var(--bg-color); color: var(--text-color);">
    
    <!-- 💥 独立させたタブバーを配置 -->
    <TabBar {handleTabClick} {handleTabClose} />

    {#if activeTab}
        <div class="flex-1 relative flex flex-col overflow-hidden" style="background-color: var(--bg-color);">
            
            {#if activeTab.path === '__SEARCH__'}
                <EditorSearch />
            {:else if activeTab.path === '__TASK__'}
               <TaskList workspaceIndex={$currentWorkspaceIndex} />
            {:else}
                
                <EditorHeader {activeTab} {toggleEditMode} />

                {#if activeTab.isEditing}
                    <textarea bind:this={editArea} class="flex-1 w-full bg-transparent resize-none focus:outline-none p-6 overflow-y-auto" style="font-family: var(--editor-font, {$editorFont}); font-size: var(--editor-font-size, 14px); line-height: var(--editor-line-height, 1.6); color: var(--text-color);" value={activeTab.content} on:input={handleInput}></textarea>
                {:else}
                    <!-- 💥 独立させたプレビュー画面を配置（イベント接続を追加） -->
                    <EditorPreview 
                        {activeTab} 
                        bind:scrollContainer={previewScrollContainer} 
                        on:renderComplete={handlePreviewRendered} 
                        on:contentChange={handlePreviewContentChange}
                    />
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

 <ConflictDialog 
     isOpen={conflictDialogOpen} 
     filePath={conflictFilePath} 
     onResolve={conflictResolve} 
 />
<!-- --- END OF src/components/Editor.svelte --- -->