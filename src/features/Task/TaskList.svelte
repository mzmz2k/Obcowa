<!-- 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { RefreshCw, CheckCircle2, EyeOff } from 'lucide-svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { fetchWorkspaceTasks, completeTaskStatus, buildTaskTree, type Task, type GroupByOption } from '../../lib/task/taskService';
    import TaskGroupNode from './TaskGroupNode.svelte';
    import { workspacesStore, openTabs, switchTab, openFileInNewTab } from '../../lib/stores';
    import { getWorkspaceNodes } from '../../lib/workspace/treeUtils';
    import ContextMenu from '../ContextMenu.svelte';
    import type { MenuItem } from '../../lib/workspace/menuUtils';

    export let workspaceIndex: number;// 呼び出し元から現在のワークスペースパスを受け取る

    let tasks: Task[] = [];
    let isLoading = false;
    let errorMessage = '';
    let updatingTasks = new Set<string>(); // 処理中のタスクを特定する用（filePath + lineNumber）
    let excludeLibrary = false;
    let groupBy: GroupByOption = 'heading'; // デフォルトは見出しごと
    let ignoreH1 = true; // デフォルトはH1無視

    // 💥 workspacesStoreから現在のツリーを生成し、リアクティブに監視する
    $: targetNodes = ($workspacesStore && $workspacesStore.length > workspaceIndex) 
        ? getWorkspaceNodes($workspacesStore, workspaceIndex, !excludeLibrary)
        : [];

    // コンテキストメニューの状態管理
    let contextMenu = {
        isOpen: false,
        x: 0,
        y: 0,
        filePath: ''
    };

    // 💥 抽出した純粋関数を使ってタスクツリーを構築する
    $: taskTreeNodes = buildTaskTree(tasks, groupBy, ignoreH1);

    // 💥 ツリーが展開されて中身が更新されたら、自動でタスクを再取得する
    $: {
        if (targetNodes && targetNodes.length > 0) {
            loadTasks();
        }
    }

    async function loadTasks() {
        if (!targetNodes || targetNodes.length === 0) return;
        isLoading = true;
        errorMessage = '';
        try {
            const excludes = $workspacesStore[workspaceIndex]?.task_exclude_paths || [];
            tasks = await fetchWorkspaceTasks(targetNodes, { excludePaths: excludes });
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    async function handleTaskChange(event: CustomEvent<{ task: Task; completed: boolean }>) {
        const { task, completed } = event.detail;
        const taskId = `${task.filePath}:${task.lineNumber}`;
        
        updatingTasks.add(taskId);
        updatingTasks = updatingTasks; // Svelteに再描画を通知

        try {
            await completeTaskStatus(task, completed);
            // TODO: エディタで対象ファイルを開いている場合は再読み込みイベントを発火させる等の連携が必要
        } catch (error: any) {
            alert(`エラー: ${error.message}\n一覧を再読み込みします。`);
            await loadTasks(); // 競合などのエラー時は再取得
        } finally {
            updatingTasks.delete(taskId);
            updatingTasks = updatingTasks;
        }
    }
    // 💥 ファイルを新しいタブで開く
    async function openFile(filePath: string, fileName: string) {
        const existingTab = $openTabs.find(t => t.path === filePath);
        if (existingTab) { 
            switchTab(existingTab.id); 
            return; 
        }
        try {
            const bytes: number[] = await invoke('read_file_content', { path: filePath });
            let content = "";
            try { 
                content = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); 
            } catch (e) { 
                content = new TextDecoder('shift-jis').decode(new Uint8Array(bytes)); 
            }
            openFileInNewTab(filePath, fileName, content);
        } catch(e) {
            console.error(e);
        }
    }
    
    // 💥 タスク一覧からファイルを除外し、ワークスペース設定を保存する
    async function excludeFileFromTasks(filePath: string) {

        workspacesStore.update(wsList => {
            const currentWs = wsList[workspaceIndex];
            if (!currentWs) return wsList;
            
            if (!currentWs.task_exclude_paths) currentWs.task_exclude_paths = [];
            if (!currentWs.task_exclude_paths.includes(filePath)) {
                currentWs.task_exclude_paths.push(filePath);
            }
            return wsList;
        });

        await invoke('save_workspaces', { workspaces: $workspacesStore });
        loadTasks(); // リストを再取得して画面から消す
    }

    // 右クリックメニューの表示
    function handleContextMenu(e: MouseEvent, filePath: string) {
        contextMenu = {
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            filePath
        };
    }

    // メニューの中身
    $: menuItems = [
        {
            label: "タスク一覧から除外",
            icon: EyeOff,
            action: () => excludeFileFromTasks(contextMenu.filePath)
        }
    ] as MenuItem[];
</script>

<div class="task-list-container">
    <div class="header">

        <div class="header-top">
            <h3 class="title">
                <CheckCircle2 size={16} />
                未完了タスク: {tasks.length}件
            </h3>
            <button class="icon-btn" on:click={loadTasks} title="更新" disabled={isLoading}>
                <RefreshCw size={16} class={isLoading ? 'spinning' : ''} />
            </button>
        </div>
        <label class="flex items-center text-sm cursor-pointer select-none" style="color: var(--text-color);">
            <input 
                type="checkbox" 
                bind:checked={excludeLibrary} 
                class="mr-2" 
                style="accent-color: var(--accent-color);"
            /> ライブラリを含めない
        </label>
        
        <!-- グループ化設定コントロール -->
        <div class="flex items-center gap-4 text-sm" style="color: var(--text-color);">
            <select 
                bind:value={groupBy} 
                class="bg-transparent border rounded p-1 cursor-pointer" 
                style="border-color: color-mix(in srgb, var(--text-color) 30%, transparent); color: var(--text-color);"
            >
                <option value="heading">見出しでまとめる</option>
                <option value="file">ファイルでまとめる</option>
            </select>
            
            {#if groupBy === 'heading'}
                <label class="flex items-center cursor-pointer select-none">
                    <input type="checkbox" bind:checked={ignoreH1} class="mr-1" style="accent-color: var(--accent-color);" />
                    H1を無視
                </label>
            {/if}
        </div>

    </div>

    {#if errorMessage}
        <div class="error-msg">{errorMessage}</div>
    {/if}

    <div class="list-content">
        {#if isLoading && tasks.length === 0}
            <div class="empty-state">スキャン中...</div>
        {:else if tasks.length === 0}
            <div class="empty-state">未完了タスクはありません</div>
        {:else}

           <div class="tree-container">
               {#each taskTreeNodes as node (node.id)}
                    <!-- 💥 新しく作った再帰コンポーネントにツリーのルートノードを渡す -->
                    <TaskGroupNode 
                        {node}
                        {groupBy}
                        isUpdatingTasks={updatingTasks}
                        on:change={handleTaskChange}
                        on:openFile={(e) => openFile(e.detail.path, e.detail.name)}
                        on:contextMenu={(e) => handleContextMenu(e.detail.event, e.detail.path)}
                    />
               {/each}
           </div>

        {/if}
    </div>
</div>
<!-- 💥 コンテキストメニューの表示 -->
{#if contextMenu.isOpen}
    <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        items={menuItems} 
        onClose={() => contextMenu.isOpen = false} 
    />
{/if}

<style>
    .task-list-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--menu-bg);
        color: var(--text-color);
        overflow: hidden;
    }

    .header {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 16px;
    }
    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 0.9em;
        font-weight: 600;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: color-mix(in srgb, var(--text-color) 70%, transparent);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-btn:hover {
        background-color: var(--active-highlight-bg);
        color: var(--text-color);
    }

    .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    :global(.spinning) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        100% { transform: rotate(360deg); }
    }

    .list-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: color-mix(in srgb, var(--text-color) 50%, transparent);
        font-size: 0.9em;
    }

    .error-msg {
        background-color: color-mix(in srgb, #ef4444 20%, transparent);
        color: #ef4444; /* エラーは目立たせるため固有色 */
        padding: 8px 12px;
        margin: 8px;
        border-radius: 4px;
        font-size: 0.85em;
    }

    .tree-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

</style>