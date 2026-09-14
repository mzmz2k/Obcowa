<!-- 責務: 見出しの抽出、検索フィルタリング、リスト表示とクリック時のジャンプイベント発行 -->
<!-- --- START OF src/components/Editor/RightSidebar/OutlinePanel.svelte --- -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Search, ChevronRight, ChevronDown } from 'lucide-svelte';
    import { extractHeadings, getVisibleHeadings, hasChildHeading, type OutlineItem } from './outlineUtils';

    export let activeTab: any;
    const dispatch = createEventDispatcher();

    let searchQuery = '';
    
    // 折りたたまれている見出しのID(headingIndex)を保存するセット
    let collapsedIndices = new Set<number>();
    
    $: content = activeTab?.content || '';
    
    let allHeadings: OutlineItem[] = [];
    $: {
        if (content) {
            allHeadings = extractHeadings(content);
        } else {
            allHeadings = [];
        }
    }

    // 検索中は全件からフィルタリング、通常時は折りたたみを考慮したリストを表示
    $: displayList = searchQuery 
        ? allHeadings.filter(h => h.text.toLowerCase().includes(searchQuery.toLowerCase()))
        : getVisibleHeadings(allHeadings, collapsedIndices);

    function handleJump(h: OutlineItem) {
        dispatch('jump', { lineIndex: h.lineIndex, headingIndex: h.headingIndex });
    }

    // 折りたたみのトグル処理
    function toggleCollapse(e: Event, headingIndex: number) {
        e.stopPropagation(); // ジャンプのクリックイベントが発火するのを防ぐ
        
        if (collapsedIndices.has(headingIndex)) {
            collapsedIndices.delete(headingIndex);
        } else {
            collapsedIndices.add(headingIndex);
        }
        // SvelteにSetの更新を検知させるため再代入
        collapsedIndices = collapsedIndices;
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
        {#if displayList.length === 0}
            <div class="text-xs text-center mt-4 opacity-50">見出しがありません</div>
        {/if}
        {#each displayList as heading, i}
            <!-- 検索中かどうか、子要素があるかどうかを判定 -->
            {@const isSearchMode = searchQuery.length > 0}
            {@const indexInAll = allHeadings.findIndex(h => h.headingIndex === heading.headingIndex)}
            {@const hasChildren = !isSearchMode && hasChildHeading(allHeadings, indexInAll)}
            {@const isCollapsed = collapsedIndices.has(heading.headingIndex)}

            <div 
                class="w-full flex items-center text-sm py-1 px-1 rounded transition-colors group cursor-pointer"
                style="
                    padding-left: {0.5 + (heading.level - 1) * 0.8}rem;
                    color: color-mix(in srgb, var(--text-color) {100 - (heading.level - 1) * 10}%, transparent);
                "
                on:mouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--active-highlight-bg)'}
                on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                on:click={() => handleJump(heading)}
            >
                <!-- 折りたたみアイコン（子要素がない場合や検索中は透明なスペースで位置合わせ） -->
                <div 
                    class="w-4 h-4 flex items-center justify-center mr-1 rounded hover:bg-black/20"
                    on:click={(e) => hasChildren && toggleCollapse(e, heading.headingIndex)}
                >
                    {#if hasChildren}
                        <div class="opacity-50 group-hover:opacity-100 transition-opacity">
                            {#if isCollapsed}
                                <ChevronRight size={14} />
                            {:else}
                                <ChevronDown size={14} />
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- 見出しテキスト -->
                <span class="truncate flex-1" title={heading.text}>
                    {heading.text}
                </span>
            </div>
        {/each}
    </div>
</div>
<!-- --- END OF src/components/Editor/RightSidebar/OutlinePanel.svelte --- -->