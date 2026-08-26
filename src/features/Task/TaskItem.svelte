<!-- タスク1件分のUI表示と、チェックボックス操作のイベント発火 -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task } from '../../lib/task/taskService';

    export let task: Task;
    export let isUpdating = false;

    const dispatch = createEventDispatcher<{ complete: Task }>();

    function handleCheck() {
        if (!isUpdating) {
            dispatch('complete', task);
        }
    }

    // ファイル名だけを抽出して表示用にする
    $: fileName = task.filePath.split(/[/\\]/).pop() || 'Unknown';
</script>

<div class="task-item">
    <label class="task-label" class:disabled={isUpdating}>
        <input 
            type="checkbox" 
            class="task-checkbox" 
            disabled={isUpdating}
            on:change={handleCheck}
        />
        <div class="task-content">
            <span class="task-text">{task.text}</span>
            <span class="task-meta">{fileName} (行: {task.lineNumber + 1})</span>
        </div>
    </label>
</div>

<style>
    .task-item {
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .task-item:hover {
        background-color: var(--active-highlight-bg);
    }

    .task-label {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
    }

    .task-label.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .task-checkbox {
        margin-top: 4px;
        cursor: inherit;
        accent-color: var(--accent-color);
    }

    .task-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        overflow: hidden;
    }

    .task-text {
        color: var(--text-color);
        font-size: 0.95em;
        line-height: 1.4;
        word-break: break-word;
    }

    .task-meta {
        /* 半透明の文字色を表現 */
        color: color-mix(in srgb, var(--text-color) 60%, transparent);
        font-size: 0.75em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>