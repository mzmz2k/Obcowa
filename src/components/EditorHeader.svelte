<!-- --- START OF src/components/EditorHeader.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { BookOpen, Pencil, ExternalLink } from 'lucide-svelte';

  export let activeTab: any;
  export let toggleEditMode: () => void;

  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout>;

  // --- パスコピー機能 ---
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

  // --- ファイル名右クリックメニュー機能 ---
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

  function closeMenu() {
    showMenu = false;
  }

  async function openInExplorer() {
    closeMenu();
    if (!activeTab || !activeTab.path) return;
    
    // JSの正規表現を使って、ファイルのフルパスから「親フォルダのパス」だけを切り出す
    const parentDir = activeTab.path.replace(/[\/\\][^\/\\]+$/, '');
    
    try {
      // 既存のRustコマンドを利用してフォルダを開く
      await invoke('open_folder', { path: parentDir });
    } catch (e) {
      console.error("エクスプローラー起動失敗:", e);
    }
  }
</script>

<!-- メニューの外側をクリックしたらメニューを閉じる -->
<svelte:window on:click={closeMenu} />

<!-- 💥 変更: py-2 を py-1 に変更し、全体の縦幅を少し狭くしました -->
<div class="flex items-center justify-between px-6 py-1 shrink-0 group transition-colors" style="background-color: var(--bg-color); color: var(--text-color);">
  
  <!-- 左寄せ：ファイル名 -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div 
    class="flex-1 truncate text-xs cursor-pointer opacity-0 hover:opacity-50 transition-opacity w-fit" 
    title="右クリックでメニュー表示"
    on:contextmenu={handleFileNameContextMenu}
  >
    {activeTab.title}
  </div>

  <!-- 中央寄せ：パス（ホバー時に表示） -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div 
    class="flex-[2] text-center truncate text-xs opacity-0 hover:opacity-60 hover:!opacity-100 transition-opacity px-4 cursor-pointer select-none" 
    title="右クリックでパスをコピー"
    on:contextmenu={copyPath}
  >
    {#if copied}
      <span class="opacity-70">パスをコピーしました</span>
    {:else}
      {activeTab.path}
    {/if}
  </div>

  <!-- 右寄せ：編集・ビュー切り替えボタン -->
  <div class="flex-1 flex justify-end">
    <!-- 💥 変更: w-8 h-8 を w-7 h-7 に縮小し、アイコンサイズも 14 に縮小して高さを抑えました -->
    <button 
        class="w-7 h-7 flex items-center justify-center rounded transition opacity-70 hover:opacity-50"
        on:click={toggleEditMode}
        title={activeTab.isEditing ? 'プレビューモードへ' : '編集モードへ'}
    >
        {#if activeTab.isEditing}
            <BookOpen size={17} />
        {:else}
            <Pencil size={17} />
        {/if}
    </button>
  </div>

</div>

<!-- コンテキストメニュー本体 -->
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