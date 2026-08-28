<!-- 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { RefreshCw, CheckCircle2, FileText } from 'lucide-svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { fetchWorkspaceTasks, completeTaskStatus, type Task } from '../../lib/task/taskService';
    import TaskItem from './TaskItem.svelte';
    import { workspacesStore, openTabs, switchTab, openFileInNewTab } from '../../lib/stores';
    import { getWorkspaceNodes } from '../../lib/workspace/treeUtils';

    export let workspaceIndex: number;// 呼び出し元から現在のワークスペースパスを受け取る

    let tasks: Task[] = [];
    let isLoading = false;
    let errorMessage = '';
    let updatingTasks = new Set<string>(); // 処理中のタスクを特定する用（filePath + lineNumber）
    let excludeLibrary = false;

    // 💥 workspacesStoreから現在のツリーを生成し、リアクティブに監視する
    $: targetNodes = ($workspacesStore && $workspacesStore.length > workspaceIndex) 
        ? getWorkspaceNodes($workspacesStore, workspaceIndex, !excludeLibrary)
        : [];

    // 💥 ファイルごとにタスクをグループ化する（表示用）
    $: groupedTasksArray = Object.entries(
        tasks.reduce((acc, task) => {
            if (!acc[task.filePath]) acc[task.filePath] = [];
            acc[task.filePath].push(task);
            return acc;
        }, {} as Record<string, Task[]>)
    ).map(([filePath, fileTasks]) => ({
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || 'Unknown',
        tasks: fileTasks
    }));

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
            // 将来的に設定ストア等から options を渡す形に拡張可能
            tasks = await fetchWorkspaceTasks(targetNodes);
        } catch (error: any) {
            errorMessage = error.message;
        } finally {
            isLoading = false;
        }
    }

    async function handleTaskComplete(event: CustomEvent<Task>) {
        const task = event.detail;
        const taskId = `${task.filePath}:${task.lineNumber}`;
        
        updatingTasks.add(taskId);
        updatingTasks = updatingTasks; // Svelteに再描画を通知

        try {
            await completeTaskStatus(task);
            // 成功したら一覧から削除
            tasks = tasks.filter(t => `${t.filePath}:${t.lineNumber}` !== taskId);
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
            <input type="checkbox" bind:checked={excludeLibrary} class="mr-2"> ライブラリを含めない
        </label>

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
           {#each groupedTasksArray as group (group.filePath)}
                <div class="task-group">
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="group-header" on:click={() => openFile(group.filePath, group.fileName)}>
                        <FileText size={14} /> {group.fileName}
                    </div>
                    {#each group.tasks as task (`${task.filePath}:${task.lineNumber}`)}
                        <TaskItem 
                            {task} 
                            isUpdating={updatingTasks.has(`${task.filePath}:${task.lineNumber}`)}
                            on:complete={handleTaskComplete}
                        />
                    {/each}
                </div>
           {/each}

        {/if}
    </div>
</div>

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
        border-bottom: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
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

    .task-group {
        margin-bottom: 12px;
    }

    .group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        font-size: 0.9em;
        font-weight: 600;
        color: var(--accent-color);
        cursor: pointer;
        border-bottom: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
        margin-bottom: 4px;
        transition: background-color 0.2s;
    }

    .group-header:hover {
        background-color: var(--active-highlight-bg);
    }
</style>