<!-- 渡されたクエリで検索を実行し、結果をコンパクトなリストで表示する -->

<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { onMount } from 'svelte';
    import { openTabs, currentWorkspaceIndex, workspacesStore, switchTab, openFileInNewTab } from '../../../lib/stores';
    import { getWorkspaceNodes } from '../../../lib/workspace/treeUtils';
    import { FileText, Search, Loader2 } from 'lucide-svelte';

    export let query: string = ''; // DashboardManagerから渡される

    let results: any[] = [];
    let isSearching = false;
    let hasSearched = false;

    // マウントされたら自動で検索を実行する
    onMount(() => {
        if (query.trim()) {
            executeSearch();
        }
    });

    async function executeSearch() {
        isSearching = true; 
        try {
            // 現在のワークスペースのノードを取得（ライブラリも含める）
            const targetNodes = getWorkspaceNodes($workspacesStore, $currentWorkspaceIndex, true);
            results = await invoke('search_files', { 
                nodes: targetNodes, 
                searchByFilename: false, // 埋め込みは全文検索をデフォルトとする
                query: query 
            }); 
            hasSearched = true;
        } 
        catch (e) { console.error("Search failed:", e); } 
        finally { isSearching = false; }
    }

    // 検索結果をクリックしてファイルを開く (EditorSearch.svelteと同じロジック)
    async function handleResultClick(path: string, name: string, forceNewTab: boolean = false) {
        if (!forceNewTab) {
            const existingTab = $openTabs.find(t => t.path === path);
            if (existingTab) { 
                switchTab(existingTab.id); 
                return; 
            }
        }
        try {
            const bytes: number[] = await invoke('read_file_content', { path });
            let content = "";
            try { 
                content = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); 
            } catch (e) { 
                content = new TextDecoder('shift-jis').decode(new Uint8Array(bytes)); 
            }
            openFileInNewTab(path, name, content);
        } catch(e) {
            console.error(e);
        }
    }
</script>

<div class="my-4 border rounded overflow-hidden" style="border-color: color-mix(in srgb, var(--text-color) 20%, transparent); background-color: color-mix(in srgb, var(--bg-color) 50%, transparent);">
    <!-- ヘッダー部分 -->
    <div class="px-3 py-2 text-sm font-bold flex items-center border-b" style="background-color: var(--menu-bg); border-color: color-mix(in srgb, var(--text-color) 10%, transparent); color: var(--text-color);">
        <Search size={14} class="mr-2 opacity-70" />
        「{query}」の検索結果
        <span class="ml-auto text-xs opacity-60 font-normal">
            {isSearching ? '検索中...' : `${results.length}件`}
        </span>
    </div>

    <!-- リスト部分 -->
    <div class="max-h-60 overflow-y-auto">
        {#if isSearching}
            <div class="flex justify-center p-4 opacity-50"><Loader2 size={20} class="animate-spin text-[var(--accent-color)]" /></div>
        {:else if hasSearched && results.length === 0}
            <div class="text-center p-4 text-sm opacity-50" style="color: var(--text-color);">見つかりませんでした</div>
        {:else}
            {#each results as res}
                 <!-- svelte-ignore a11y-click-events-have-key-events -->
                 <!-- svelte-ignore a11y-no-static-element-interactions -->
                 <div 
                    class="py-2 px-3 border-b last:border-b-0 cursor-pointer transition hover:bg-[var(--active-highlight-bg)]" 
                    style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
                    on:click={() => handleResultClick(res.path, res.name, false)} 
                    on:contextmenu|preventDefault={() => handleResultClick(res.path, res.name, true)}
                >
                    <div class="flex items-center font-bold text-sm" style="color: var(--accent-color);">
                        <FileText size={14} class="mr-1" /> {res.name}
                    </div>
                    <!-- 長すぎるスニペットはUI崩れを防ぐため短く切り詰める -->
                    <div class="text-xs truncate mt-1 opacity-70" style="color: var(--text-color);">{res.snippet}</div>
                </div>
            {/each}
        {/if}
    </div>
</div>