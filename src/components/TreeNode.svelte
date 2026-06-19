<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInTab } from '../lib/stores';
  import { getContext } from 'svelte'; // 👈 追加

  export let node: any;
  let isOpen = false;

  // 👈 親（メイン画面）から「削除するための関数」を受け取る
  const { removeNode } = getContext('workspaceActions') as any;

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
        openFileInTab(node.path, node.name, content);
      } catch (e) {
        console.error("ファイル読み込み失敗:", e);
      }
    }
  }

  // 💥 右クリックされたときの処理
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault(); // ブラウザ標準の右クリックメニューを無効化
    
    // 軽量化のためOS標準の確認ダイアログを使用
    if (confirm(`「${node.name}」をワークスペースから外しますか？\n（元の実ファイルは削除されません）`)) {
      removeNode(node);
    }
  }
</script>

<div class="ml-2">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- 💥 on:contextmenu を追加 -->
  <div 
    class="flex items-center p-1 hover:bg-gray-700 rounded text-sm cursor-pointer select-none transition-colors text-gray-300"
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

  {#if isOpen && node.children && node.children.length > 0}
    <div class="border-l border-gray-600 ml-2 pl-1">
      {#each node.children as childNode}
        <svelte:self node={childNode} />
      {/each}
    </div>
  {/if}
</div>