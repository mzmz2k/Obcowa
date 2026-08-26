<!-- 責務: ワークスペースの未完了タスク一覧を表示し、更新を管理する親コンポーネント -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { RefreshCw, CheckCircle2 } from 'lucide-svelte';
    import { fetchWorkspaceTasks, completeTaskStatus, type Task } from '../../lib/task/taskService';
    import TaskItem from './TaskItem.svelte';

    export let workspaceIndex: number; // 呼び出し元から現在のワークスペースパスを受け取る

    let tasks: Task[] = [];
    let isLoading = false;
    let errorMessage = '';
    let updatingTasks = new Set<string>(); // 処理中のタスクを特定する用（filePath + lineNumber）

    async function loadTasks() {
        if (workspaceIndex === undefined || workspaceIndex === null) return;
        isLoading = true;
        errorMessage = '';
        try {
            // 将来的に設定ストア等から options を渡す形に拡張可能
            tasks = await fetchWorkspaceTasks(workspaceIndex);
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

    onMount(() => {
        loadTasks();
    });
</script>

<div class="task-list-container">
    <div class="header">
        <h3 class="title">
            <CheckCircle2 size={16} />
            未完了タスク: {tasks.length}件
        </h3>
        <button class="icon-btn" on:click={loadTasks} title="更新" disabled={isLoading}>
            <RefreshCw size={16} class={isLoading ? 'spinning' : ''} />
        </button>
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
            {#each tasks as task (task.filePath + task.lineNumber)}
                <TaskItem 
                    {task} 
                    isUpdating={updatingTasks.has(`${task.filePath}:${task.lineNumber}`)}
                    on:complete={handleTaskComplete}
                />
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
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
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
</style>