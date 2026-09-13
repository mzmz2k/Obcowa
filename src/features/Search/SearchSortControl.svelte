<!-- 検索ソートのアイコンUIと、状態の永続化保存 -->
<script lang="ts">
    import { searchState, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
    import { invoke } from '@tauri-apps/api/core';
    import { Clock, CalendarPlus, Type } from 'lucide-svelte';
    import { requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';

    const options = [
        { key: 'updated', icon: Clock, title: '更新日でソート' },
        { key: 'created', icon: CalendarPlus, title: '作成日でソート' },
        { key: 'name', icon: Type, title: 'ファイル名でソート' }
    ];

    async function handleSortClick(key: string) {
        if ($searchState.sortKey === key) {
            $searchState.sortOrder = $searchState.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            $searchState.sortKey = key;
            $searchState.sortOrder = key === 'name' ? 'asc' : 'desc'; 
        }

        if ($workspacesStore[$currentWorkspaceIndex]) {
            $workspacesStore[$currentWorkspaceIndex].search_sort_by = $searchState.sortKey;
            $workspacesStore[$currentWorkspaceIndex].search_sort_order = $searchState.sortOrder;
            try {
                await requestSaveWorkspaces();
            } catch (e) {
                console.error("設定保存エラー", e);
            }
        }
    }
</script>

<div class="flex items-center gap-2 text-sm text-[var(--text-color)] opacity-70">
    {#each options as { key, icon, title }}
        <button 
            class="p-1 rounded hover:bg-[var(--active-highlight-bg)] transition-colors 
                   {$searchState.sortKey === key ? 'text-[var(--accent-color)] opacity-100' : ''}"
            title={title}
            on:click={() => handleSortClick(key)}
        >
            <svelte:component this={icon} size={16} />
        </button>
    {/each}
</div>