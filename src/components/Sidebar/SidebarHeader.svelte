<!-- サイドバー上部の新規追加ボタン等-->
<!-- --- START OF src/components/Sidebar/SidebarHeader.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { RotateCw, ArrowUpDown, Search, FolderPlus, FilePlus } from 'lucide-svelte';
  import { openSearchTab } from '../../lib/stores';

  const dispatch = createEventDispatcher();

  // 親から受け取るデータ
  export let workspaces: any[] = [];
  export let currentIndex: number;

  // メニューの開閉状態（この部品の中だけで完結する）
  let isGlobalSortMenuOpen = false;
  let isAddFolderMenuOpen = false;

  // ウィンドウ外をクリックした時にメニューを閉じる
  function closeMenus() {
    isGlobalSortMenuOpen = false;
    isAddFolderMenuOpen = false;
  }

  // --- ソート変更処理 ---
  function changeGlobalSort(type: 'by' | 'order', value: string) {
    if (workspaces[currentIndex]) {
      if (type === 'by') workspaces[currentIndex].sort_by = value;
      else workspaces[currentIndex].sort_order = value;
      // 親に「データが変わったから保存して」と伝える
      dispatch('save');
    }
  }

  // --- フォルダ・ファイル追加処理 ---
  async function addFolder() {
    isAddFolderMenuOpen = false;
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      const newNode = { type: "Folder", name: selectedPath.split(/[/\\]/).pop() || '新規フォルダ', original_path: selectedPath, children: [] };
      dispatch('addNode', newNode);
    }
  }

  async function addFile() {
    isAddFolderMenuOpen = false;
    const selectedPath = await openDialog({ directory: false, multiple: false });
    if (typeof selectedPath === 'string') {
      const newNode = { type: "File", name: selectedPath.split(/[/\\]/).pop() || '新規ファイル', path: selectedPath };
      dispatch('addNode', newNode);
    }
  }

  // スマートフォルダ（抽出）モーダルを開くよう親に依頼
  function openSmartFolderModal() {
    isAddFolderMenuOpen = false;
    dispatch('openSmartFolder');
  }
</script>

<svelte:window on:click={closeMenus} />

<div class="p-3 border-b border-black/10 font-bold flex justify-between items-center shrink-0">
  <!-- リスト名 -->
  <span class="truncate pr-2">{workspaces[currentIndex]?.name || 'リスト'}</span>
  
  <div class="flex gap-2 shrink-0 relative">
    
    <!-- 更新ボタン（親に処理を依頼） -->
    <button on:click={() => dispatch('refresh')} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="更新">
      <RotateCw size={14} />
    </button>

    <!-- ソートメニュー -->
    <div class="relative flex items-center">
      <button on:click|stopPropagation={() => isGlobalSortMenuOpen = !isGlobalSortMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="並び替え">
        <ArrowUpDown size={14} />
      </button>
      
      {#if isGlobalSortMenuOpen}
        <div class="absolute top-8 left-0 border border-black/20 rounded shadow-xl z-50 py-1 w-32 text-sm font-normal" style="background-color: var(--menu-bg); color: var(--text-color);">
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('order', 'asc')}>
            <span class="inline-block w-4">{workspaces[currentIndex]?.sort_order !== 'desc' ? '✓' : ''}</span>昇順
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('order', 'desc')}>
            <span class="inline-block w-4">{workspaces[currentIndex]?.sort_order === 'desc' ? '✓' : ''}</span>降順
          </button>
          <hr class="border-black/10 my-1">
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'name')}>
            <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'name' || !workspaces[currentIndex]?.sort_by ? '✓' : ''}</span>名前
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'created')}>
            <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'created' ? '✓' : ''}</span>作成日
          </button>
          <button class="block w-full text-left px-4 py-1.5 hover:opacity-70 transition" on:click={() => changeGlobalSort('by', 'modified')}>
            <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'modified' ? '✓' : ''}</span>更新日
          </button>
        </div>
      {/if}
    </div>
    
    <!-- 検索ボタン（ストアの関数を直接呼ぶ） -->
    <button on:click={openSearchTab} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="検索">
      <Search size={14} />
    </button>
    
    <!-- 追加メニュー -->
    <button on:click|stopPropagation={() => isAddFolderMenuOpen = !isAddFolderMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" >
      <FolderPlus size={14} />
    </button>
    
    {#if isAddFolderMenuOpen}
      <div class="absolute top-8 right-0 border border-black/20 rounded shadow-xl z-50 py-1 w-40 text-sm font-normal" style="background-color: var(--menu-bg); color: var(--text-color);">
        <button class="block w-full text-left px-4 py-2 hover:opacity-70 transition"  on:click={addFolder}>普通のフォルダ</button>
        <button class="flex items-center w-full text-left px-4 py-2 hover:opacity-70 transition" on:click={addFile}><FilePlus size={14} class="mr-2" /> ファイルを追加</button>
        <button class="flex items-center w-full text-left px-4 py-2 hover:opacity-70 transition" on:click={openSmartFolderModal}><Search size={14} class="mr-2" /> 条件で抽出</button>
      </div>
    {/if}
  </div>
</div>
<!-- --- END OF src/components/Sidebar/SidebarHeader.svelte --- -->
