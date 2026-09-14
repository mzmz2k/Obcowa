<!-- 責務: 見出しの抽出、検索フィルタリング、リスト表示とクリック時のジャンプイベント発行 -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Search } from 'lucide-svelte';
    import { extractHeadings, type OutlineItem } from './outlineUtils';

    export let activeTab: any;
    const dispatch = createEventDispatcher();

    let searchQuery = '';
    
    // 💡 確実にSvelteに変更を検知させるため、contentを一度ローカルのリアクティブ変数で受ける
    $: content = activeTab?.content || '';
    
    // contentが変わった時のみ抽出を再実行
    let headings: OutlineItem[] = [];
    $: {
        if (content) {
            headings = extractHeadings(content);
        } else {
            headings = [];
        }
    }

    // 検索窓の入力でフィルタリング
    $: filteredHeadings = headings.filter(h => h.text.toLowerCase().includes(searchQuery.toLowerCase()));

    function handleJump(h: OutlineItem) {
        dispatch('jump', { lineIndex: h.lineIndex, headingIndex: h.headingIndex });
    }
</script>

<div class="flex flex-col h-full">
    <!-- 検索バー -->
    <div class="p-2 border-b border-black/20" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <div class="flex items-center rounded px-2 py-1" style="background-color: color-mix(in srgb, var(--text-color) 5%, transparent);">
            <Search size={14} class="opacity-50" />
            <input 
                bind:value={searchQuery} 
                type="text" 
                placeholder="見出しを検索..." 
                class="bg-transparent border-none outline-none text-sm ml-2 w-full"
                style="color: var(--text-color);"
            />
        </div>
    </div>
    
    <!-- 見出しリスト -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#if filteredHeadings.length === 0}
            <div class="text-xs text-center mt-4 opacity-50">見出しがありません</div>
        {/if}
        {#each filteredHeadings as heading}
            <button 
                on:click={() => handleJump(heading)}
                class="w-full text-left text-sm py-1 px-2 rounded truncate transition-colors"
                style="
                    padding-left: {0.5 + (heading.level - 1) * 0.8}rem;
                    color: color-mix(in srgb, var(--text-color) {100 - (heading.level - 1) * 10}%, transparent);
                "
                on:mouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--active-highlight-bg)'}
                on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={heading.text}
            >
                {heading.text}
            </button>
        {/each}
    </div>
</div>
<!-- --- END OF src/components/Editor/RightSidebar/OutlinePanel.svelte --- -->