<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInCurrentTab, openFileInNewTab, activeTabId } from '../lib/stores';
  import { getContext } from 'svelte';

  export let node: any;
  let isOpen = false;

  const { removeNode } = getContext('workspaceActions') as any;

  // 現在アクティブなファイルかどうかを判定
  $: isActive = $activeTabId === node.path;

  // 💥 右クリックメニューの状態
  let showMenu = false;
  let menuX = 0;
  let menuY = 0;

  async function handleClick() {
    if (node.type === 'Folder') {
      isOpen = !isOpen;
      if (isOpen && node.children && node.children.length === 0 && node.original_path) {
        try {
          node.children = await invoke('read_directory', { path: node.original_path });
        } catch (e) {
          console.error("フォルダ読み込み失敗:", e);
        }
      }
    } else if (node.type === 'File') {
      try {
        const content: string = await invoke('read_file_content', { path: node.path });
        openFileInCurrentTab(node.path, node.name, content); // 👈ここを変更
      } catch (e) {
        console.error("ファイル読み込み失敗:", e);
      }
    }
  }

  // 右クリック時の処理（メニューを出す）
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    showMenu = true;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  // 画面のどこかをクリックしたらメニューを閉じる
  function closeMenu() {
    showMenu = false;
  }
</script>

<svelte:window on:click={closeMenu} />

<div class="ml-2 relative">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- 💥 isActive のときに背景色を青っぽくする -->
  <div 
    class="flex items-center p-1 rounded text-sm cursor-pointer select-none transition-colors 
           {isActive ? 'bg-blue-900 text-white font-bold' : 'text-gray-300 hover:bg-gray-700'}"
    on:click={handleClick}
    on:contextmenu={handleContextMenu}
  >
    <span class="mr-1 w-4 text-center">
      {#if node.type === 'Folder'}
        {isOpen ? '📂' : '📁'}
      {:else}
        📄
      {/if}
    </span>
    <span class="truncate">{node.name}</span>
  </div>

  <!-- 💥 カスタムコンテキストメニュー -->
  {#if showMenu}
    <div 
      class="fixed bg-gray-800 border border-gray-600 rounded shadow-xl z-50 py-1 w-48"
      style="left: {menuX}px; top: {menuY}px;"
    >
      {#if node.type === 'File'}
        <button 
          class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
          on:click={async () => {
            const content = await invoke('read_file_content', { path: node.path });
            openFileInNewTab(node.path, node.name, content);
            closeMenu();
          }}
        >
          新しいタブで開く
        </button>
      {/if}
      
      <button 
        class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition"
        on:click={() => removeNode(node)}
      >
        リストから削除
      </button>
    </div>
  {/if}

  {#if isOpen && node.children && node.children.length > 0}
    <div class="border-l border-gray-600 ml-2 pl-1">
      {#each node.children as childNode}
        <svelte:self node={childNode} />
      {/each}
    </div>
  {/if}
</div>