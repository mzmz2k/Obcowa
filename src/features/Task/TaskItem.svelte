<!-- タスク1件分のUI表示と、チェックボックス操作のイベント発火 -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Task } from '../../lib/task/taskService';

    export let task: Task;
    export let isUpdating = false;

    let isChecked = false;

    const dispatch = createEventDispatcher<{ complete: Task }>();

    function handleCheck() {
        if (!isUpdating && isChecked) {
            dispatch('complete', task);
        }
    }

</script>

<div class="task-item">
    <div class="task-item-row" class:disabled={isUpdating}>
        <input 
            type="checkbox" 
            class="task-checkbox" 
            disabled={isUpdating}
            bind:checked={isChecked}
            on:change={handleCheck}
        />
        <div class="task-content">
            <span class="task-text" class:completed={isChecked}>{task.text}</span>
        </div>
    </div>
</div>

<style>
    .task-item {
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .task-item-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
    }

    .task-item-row.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .task-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 1.2rem;
        height: 1.2rem;
        border: 1.5px solid color-mix(in srgb, var(--text-color) 40%, transparent);
        border-radius: 50%;
        outline: none;
        cursor: pointer;
        margin-top: 2px;
        margin-right: 4px;
        vertical-align: middle;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: background-color 0.15s ease, border-color 0.15s ease;
        background-color: transparent;
        flex-shrink: 0;
    }

    .task-checkbox:hover:not(:disabled) {
        border-color: var(--accent-color);
    }

    .task-checkbox:checked {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
    }

    .task-checkbox:checked::after {
        content: '';
        width: 0.35rem;
        height: 0.6rem;
        border: solid var(--bg-color); /* 背景色と同色でチェックマーク */
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        margin-bottom: 2px;
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
        user-select: text;
    }

    .task-text.completed {
        text-decoration: line-through;
        opacity: 0.5;
    }

</style>