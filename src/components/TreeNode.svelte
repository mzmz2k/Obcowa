<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInCurrentTab, openFileInNewTab, activeTabId, openTabs, switchTab } from '../lib/stores'; // 💥 openTabsとswitchTabを追加
  import { getContext } from 'svelte';

  export let node: any;
  export let isReadonly = false; 
  let isOpen = false;

   const { removeNode, pinNode, unpinNode, checkIsPinned, getClickBehavior, saveWorkspace } = getContext('workspaceActions') as any;

  // 現在アクティブなタブの path と一致しているか判定
  $: activeTab = $openTabs.find(t => t.id === $activeTabId);
  $: isActive = activeTab && activeTab.path === node.path;

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
        const content = await loadFileContent(node.path);
        const openInNewTab = getClickBehavior(); // 💥 設定を取得

        if (openInNewTab) {
          // すでに開いている場合はそのタブをアクティブにする
          const existingTab = $openTabs.find(t => t.path === node.path);
          if (existingTab) {
            switchTab(existingTab.id);
          } else {
            openFileInNewTab(node.path, node.name, content);
          }
        } else {
          openFileInCurrentTab(node.path, node.name, content);
        }
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

  // ファイルをバイト列として読み込み、文字コードを判定してデコードする
  async function loadFileContent(path: string): Promise<string> {
    const bytes: number[] = await invoke('read_file_content', { path });
    const uint8Array = new Uint8Array(bytes);
    try {
      // まずUTF-8として厳密にデコード
      return new TextDecoder('utf-8', { fatal: true }).decode(uint8Array);
    } catch (e) {
      // 失敗した場合はShift-JISとしてデコード（Windowsのメモ帳などで作成されたファイル対策）
      return new TextDecoder('shift-jis').decode(uint8Array);
    }
  }

  function renameFolder() {
    const newName = prompt("リストに表示する名前を入力してください（実フォルダ名は変わりません）", node.name);
    if (newName && newName.trim() !== '') {
      node.name = newName;
      saveWorkspace();
    }
  }

  async function createNewFileInFolder() {
    const fileName = prompt("新しいファイル名を入力してください\n（例: memo.md, text.txt）", "新しいファイル.md");
    if (!fileName) return;
    try {
      await invoke('create_new_file', { dirPath: node.original_path, fileName });
      // 💥 作成後、フォルダを開いて中身を再読み込みする
      isOpen = true;
      node.children = await invoke('read_directory', { path: node.original_path });
      saveWorkspace();
    } catch (e) {
      alert("ファイル作成に失敗しました: " + e);
    }
  }

  async function openInExplorer() {
    try {
      // 💥 Rust側に作ってもらったコマンドを呼ぶ
      await invoke('open_folder', { path: node.original_path });
    } catch (e) {
      console.error("エクスプローラー起動失敗:", e);
    }
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

    <span class="mr-1 w-3 text-center text-xs text-gray-500">
      {#if node.type === 'Folder'}
        {isOpen ? '▼' : '▶'}
      {/if}
    </span>
    <span class="mr-1 w-4 text-center">
      {#if node.type === 'Folder'}
        <!-- 💥 ライブラリのルートの場合は本アイコンにする -->
        {#if node.is_library_root}
          📚
        {:else}
          {isOpen ? '📂' : '📁'}
        {/if}
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
            const content = await loadFileContent(node.path);
            openFileInNewTab(node.path, node.name, content);
            closeMenu();
          }}
        >
          新しいタブで開く
        </button>
      {/if}

      <!-- 変更：ピン留め状態によって「ピン留め」と「解除」を切り替え -->
      {#if checkIsPinned(node)}
        <button 
          class="block w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-gray-700 transition"
          on:click={() => { unpinNode(node); closeMenu(); }}
        >
          📌 ピン留め解除
        </button>
      {:else}
        <button 
          class="block w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-gray-700 transition"
          on:click={() => { pinNode(node); closeMenu(); }}
        >
          📌 ピン留め
        </button>
      {/if}

      <!-- 💥 新規追加：フォルダ専用メニュー -->
      {#if node.type === 'Folder'}
        {#if !isReadonly}
          <button 
            class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
            on:click={() => { renameFolder(); closeMenu(); }}
          >
            ✏️ 表示名を変更
          </button>
          
          {#if node.original_path}
            <button 
              class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
              on:click={() => { createNewFileInFolder(); closeMenu(); }}
            >
              📄 新規ファイル作成
            </button>
          {/if}
        {/if}

        {#if node.original_path}
          <button 
            class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
            on:click={() => { openInExplorer(); closeMenu(); }}
          >
            📂 エクスプローラーで開く
          </button>
        {/if}
      {/if}

      <!-- 💥 読み取り専用（ライブラリ経由）のときは削除ボタンを隠す -->
      {#if !isReadonly}
        <button 
          class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition"
          on:click={() => { removeNode(node); closeMenu(); }}
        >
          リストから削除
        </button>
      {/if}
      
    </div>
  {/if}

  {#if isOpen && node.children && node.children.length > 0}
    <div class="border-l border-gray-600 ml-2 pl-1">
      {#each node.children as childNode}
        <!-- 💥 子ノードにも isReadonly を伝播させる（孫フォルダも読み取り専用になる） -->
        <svelte:self node={childNode} {isReadonly} />
      {/each}
    </div>
  {/if}

</div>