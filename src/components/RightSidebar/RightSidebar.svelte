<!-- 責務: 右サイドバーの親枠。将来タブが増えた際の切り替えや閉じる処理を担う -->
<script lang="ts">
    import { ListTree, Tags, PanelRightClose } from 'lucide-svelte';
    import OutlinePanel from './OutlinePanel.svelte';

    export let activeTab: any;
    export let onClose: () => void;
    
    // 将来タグ検索等を追加するためのView切り替え用
    let currentView = 'outline';
</script>

<div class="w-64 h-full flex flex-col border-l" style="background-color: var(--menu-bg); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
    <!-- ヘッダー（アイコンタブ） -->
    <div class="flex items-center p-2 border-b gap-2" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
        <button 
            on:click={() => currentView = 'outline'} 
            class="p-1 rounded transition-colors"
            style="background-color: {currentView === 'outline' ? 'var(--active-highlight-bg)' : 'transparent'};"
            title="アウトライン"
        >
            <ListTree size={18} />
        </button>
        <button 
            on:click={() => currentView = 'tags'} 
            class="p-1 rounded transition-colors opacity-50 hover:opacity-100"
            title="タグ (将来拡張用)"
        >
            <Tags size={18} />
        </button>
        
        <div class="flex-1"></div>
        
        <button 
            on:click={onClose} 
            class="p-1 rounded opacity-70 hover:opacity-100"
            title="閉じる"
            on:mouseenter={(e) => e.currentTarget.style.backgroundColor = 'var(--active-highlight-bg)'}
            on:mouseleave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            <PanelRightClose size={18} />
        </button>
    </div>
    
    <!-- コンテンツ -->
    <div class="flex-1 overflow-hidden">
        {#if currentView === 'outline'}
            <OutlinePanel {activeTab} on:jump />
        {:else}
            <div class="p-4 text-sm opacity-50 flex items-center justify-center h-full">将来の実装エリア</div>
        {/if}
    </div>
</div>
<!-- --- END OF src/components/Editor/RightSidebar/RightSidebar.svelte --- -->