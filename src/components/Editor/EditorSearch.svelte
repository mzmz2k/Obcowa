<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { openTabs, currentWorkspaceIndex, switchTab, openFileInNewTab } from '../../lib/stores';
    import { FileText } from 'lucide-svelte';

    let searchQuery = '';
    let includeLibrary = false;
    let searchResults: any[] = [];
    let isSearching = false;
    let hasSearched = false;

    // 検索の実行
    async function executeSearch() {
        if (!searchQuery.trim()) return;
        isSearching = true; 
        hasSearched = true;
        try { 
            searchResults = await invoke('search_files', { 
                workspaceIndex: $currentWorkspaceIndex, 
                includeLibrary, 
                query: searchQuery 
            }); 
        } 
        catch (e) { alert("検索に失敗しました: " + e); } 
        finally { isSearching = false; }
    }

    // 検索結果をクリックしてファイルを開く
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

<div class="p-8 flex flex-col h-full">
    <!-- 💥 見出し -->
    <h2 class="text-xl font-bold mb-4" style="color: var(--text-color);">ファイル検索</h2>
    
    <div class="flex gap-4 items-center mb-6">
        <!-- 💥 検索ボックス：枠線を黒の透明度（border-black/20）に変更 -->
        <input 
            type="text" 
            bind:value={searchQuery} 
            on:keydown={(e) => e.key === 'Enter' && executeSearch()} 
            class="flex-1 border rounded p-2 text-sm outline-none" 
            style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);" 
            placeholder="検索キーワードを入力... (Enterで検索)"
        >
        
        <label class="flex items-center text-sm cursor-pointer select-none" style="color: var(--text-color);">
            <input type="checkbox" bind:checked={includeLibrary} class="mr-2"> ライブラリを含める
        </label>
        
        <!-- 💥 検索ボタン：青固定ではなく、テーマのアクセントカラーを使う -->
        <button 
            on:click={executeSearch} 
            disabled={isSearching} 
            class="px-6 py-2 rounded text-sm font-bold transition text-white hover:brightness-110 disabled:opacity-50"
            style="background-color: var(--accent-color);"
        >
            検索
        </button>
    </div>
    
    <div class="flex-1 overflow-y-auto pr-2">
        {#if isSearching}
            <!-- 💥 検索中のテキスト：不透明度を利用（opacity-50） -->
            <div class="text-center py-10 opacity-50" style="color: var(--text-color);">検索中...</div>
        {:else}
            {#each searchResults as res}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->

                <!-- 💥 検索結果の行：ホバー時にテーマカラーを使う（hover:bg-[var(--active-highlight-bg)]） -->
                 <div 
                    class="py-1.5 px-2 border-b cursor-pointer transition hover:bg-[var(--active-highlight-bg)]" 
                    style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
                    on:click={() => handleResultClick(res.path, res.name, false)} 
                    on:contextmenu|preventDefault={() => handleResultClick(res.path, res.name, true)}
                >
                    <!-- 💥 ファイル名アイコン：アクセントカラーを使用 -->
                    <div class="flex items-center font-bold text-sm" style="color: var(--accent-color);">
                        <FileText size={14} class="mr-1" /> {res.name}
                    </div>
                    <!-- 💥 スニペット：不透明度を利用（opacity-70） -->
                    <div class="text-xs truncate mt-1 opacity-70" style="color: var(--text-color);">{res.snippet}</div>
                </div>
            {/each}
            
            {#if searchResults.length === 0 && hasSearched}
                <div class="text-center py-10 opacity-50" style="color: var(--text-color);">見つかりませんでした</div>
            {/if}
        {/if}
    </div>
</div>
