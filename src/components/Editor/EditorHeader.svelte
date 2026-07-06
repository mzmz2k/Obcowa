<!-- --- START OF src/components/EditorHeader.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { BookOpen, Pencil, ExternalLink } from 'lucide-svelte';

  export let activeTab: any;
  export let toggleEditMode: () => void;

  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout>;

  async function copyPath(e: MouseEvent) {
    e.preventDefault(); 
    if (!activeTab || !activeTab.path) return;
    try {
      await navigator.clipboard.writeText(activeTab.path);
      copied = true;
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => { copied = false; }, 2000);
    } catch (err) {
      console.error('コピーに失敗しました', err);
    }
  }

  let showMenu = false;
  let menuX = 0;
  let menuY = 0;

  function handleFileNameContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (!activeTab || !activeTab.path) return;
    showMenu = true;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  function closeMenu() { showMenu = false; }

  async function openInExplorer() {
    closeMenu();
    if (!activeTab || !activeTab.path) return;
    const parentDir = activeTab.path.replace(/[\/\\][^\/\\]+$/, '');
    try { await invoke('open_folder', { path: parentDir }); } catch (e) {}
  }
</script>

<svelte:window on:click={closeMenu} />


<div class="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 pointer-events-none group/header">
  
  <!-- 左＆中央：ファイル名とパス（カプセル型の背景） -->

  <div class="flex items-center gap-2 max-w-[80%]">
    
    <!-- 左寄せ：ファイル名 -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->

      <div 
      class="pointer-events-auto px-3 py-1 rounded-full transition-all duration-300 opacity-0 hover:!opacity-100 hover:bg-[var(--bg-color)] hover:bg-opacity-10 truncate text-xs cursor-pointer font-bold w-fit shrink-0" 
      title="右クリックでメニュー表示"
      on:contextmenu={handleFileNameContextMenu}
    >
          {activeTab.title}
    </div>

    <!-- 中央寄せ：パス -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div 
      class="pointer-events-auto px-3 py-1 rounded-full transition-all duration-300 opacity-0  hover:!opacity-100 hover:bg-[var(--bg-color)] hover:bg-opacity-10 truncate text-xs cursor-pointer select-none" 
      title="右クリックでパスをコピー"
      on:contextmenu={copyPath}
    >
      {#if copied}
        <span class="opacity-100">パスをコピーしました</span>
      {:else}
        {activeTab.path}
      {/if}

    </div>
  </div>

  <!-- 右寄せ：編集・ビュー切り替えボタン -->
  <!-- 💥 変更: ボタンは常時表示。pointer-events-auto でクリック判定を復活 -->
  <div class="pointer-events-auto">
    <button 
        class="w-8 h-8 flex items-center justify-center rounded transition-opacity opacity-80 hover:opacity-100 hover:bg-opacity-10" style="background-color: var(--bg-color);"
        on:click={toggleEditMode}
        title={activeTab.isEditing ? 'プレビューモードへ' : '編集モードへ'}
    >
        {#if activeTab.isEditing}
            <BookOpen size={16} />
        {:else}
            <Pencil size={16} />
        {/if}
    </button>
  </div>

</div>

{#if showMenu}
  <div 
    class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-56"
    style="left: {menuX}px; top: {menuY}px; background-color: var(--menu-bg); color: var(--text-color);"
  >
    <button 
      class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
      on:click={openInExplorer}
    >
      <ExternalLink size={14} class="mr-2" /> エクスプローラーで表示
    </button>
  </div>
{/if}
<!-- --- END OF src/components/EditorHeader.svelte --- -->