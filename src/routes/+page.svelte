<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import Editor from '../components/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import { editorFont } from '../lib/stores';

    // 💥 設定モーダル用の状態
  let isSettingsOpen = false;
  let tempFont = '';

  function openSettings() {
    tempFont = $editorFont;
    isSettingsOpen = true;
  }
  function saveSettings() {
    $editorFont = tempFont;
    isSettingsOpen = false;
  }

  // --- ドラッグリサイズ用の状態 ---
  let sidebarWidth = 260;
  let isResizing = false;

  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) {
    if (isResizing) {
      sidebarWidth = Math.max(150, Math.min(e.clientX, 800));
    }
  }

  // --- ワークスペースのデータ管理 ---
  let workspaces: any[] = [];
  let currentIndex = 0; // 現在開いているワークスペースの番号

  // 💥 子コンポーネント（TreeNode）から呼び出せる削除処理を登録
  setContext('workspaceActions', {
    removeNode: (targetNode: any) => {
      if (!workspaces[currentIndex]) return;

      // ツリーの中をくまなく探して、該当ノードだけを除外する関数
      function filterOutNode(nodes: any[]) {
        return nodes.filter(n => n !== targetNode).map(n => {
          if (n.children) {
            n.children = filterOutNode(n.children);
          }
          return n;
        });
      }
      
      workspaces[currentIndex].nodes = filterOutNode(workspaces[currentIndex].nodes);
      workspaces = [...workspaces]; // 画面を更新
      saveData();
    }
  });

  onMount(async () => {
    try {
      workspaces = await invoke('load_workspaces');
      if (workspaces.length === 0) {
        workspaces = [{ id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [] }];
      }
    } catch (e) {
      console.error("ロード失敗:", e);
    }
  });

  async function saveData() {
    try {
      await invoke('save_workspaces', { workspaces });
    } catch (e) {
      console.error("セーブ失敗:", e);
    }
  }

  async function addFolder() {
    if (!workspaces[currentIndex]) return;
    const selectedPath = await open({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      const name = selectedPath.split(/[/\\]/).pop() || '新規フォルダ';
      workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "Folder", name, original_path: selectedPath, children: [] }];
      await saveData();
    }
  }

  async function addFile() {
    if (!workspaces[currentIndex]) return;
    const selectedPath = await open({ directory: false, multiple: false });
    if (typeof selectedPath === 'string') {
      const name = selectedPath.split(/[/\\]/).pop() || '新規ファイル';
      workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "File", name, path: selectedPath }];
      await saveData();
    }
  }

  // 💥 ワークスペース（リスト）の追加
  async function createNewWorkspace() {
    // OS標準のシンプルな入力ダイアログを使用
    const name = prompt("新しいリストの名前を入力してください", "新しいリスト");
    if (name) {
      workspaces = [...workspaces, { id: Date.now().toString(), name, category: 'Active', nodes: [] }];
      currentIndex = workspaces.length - 1; // 新しいリストに切り替える
      await saveData();
    }
  }

  // 💥 ワークスペースの切り替え
  function changeWorkspace(e: Event) {
    const target = e.target as HTMLSelectElement;
    currentIndex = parseInt(target.value, 10);
  }
</script>

<svelte:window on:mousemove={doResize} on:mouseup={stopResize} />

<main class="h-screen w-screen flex bg-gray-900 text-gray-200 select-none">
  
  <!-- 左サイドバー -->
  <div class="bg-gray-800 flex flex-col" style="width: {sidebarWidth}px">
    
    <!-- ワークスペース名と追加ボタン -->
    <div class="p-3 border-b border-gray-700 font-bold flex justify-between items-center text-gray-300">
      <span class="truncate pr-2">{workspaces[currentIndex]?.name || 'リスト'}</span>
      <div class="flex gap-2 shrink-0">
        <button on:click={addFile} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition" title="ファイル追加">📄</button>
        <button on:click={addFolder} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition" title="フォルダ追加">📁</button>
      </div>
    </div>
    
    <!-- ツリー表示エリア -->
    <div class="flex-1 p-2 overflow-auto">
      {#if workspaces.length > 0 && workspaces[currentIndex]}
        {#each workspaces[currentIndex].nodes as node}
          <TreeNode {node} />
        {/each}
        {#if workspaces[currentIndex].nodes.length === 0}
          <p class="text-sm text-gray-500 p-2">右上のボタンから追加してください</p>
        {/if}
      {:else}
        <p class="text-sm text-gray-500 p-2">データを読み込み中...</p>
      {/if}
    </div>

    <!-- 💥 左下のワークスペース切り替えUI -->
    <div class="p-2 border-t border-gray-700 bg-gray-800 flex items-center gap-1">
      <select 
        class="w-32 bg-gray-700 text-xs text-gray-200 rounded py-1 px-1 outline-none border border-gray-600 focus:border-blue-500"
        value={currentIndex}
        on:change={changeWorkspace}
      >
        {#each workspaces as ws, index}
          <option value={index}>{ws.name}</option>
        {/each}
      </select>
      <button 
        on:click={createNewWorkspace} 
        class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition flex-shrink-0"
        title="新しくリストを作る"
      >
        ＋
      </button>
      <div class="flex-1"></div> <!-- 余白を埋めて歯車を右に押しやる -->
      <button 
        on:click={openSettings}
        class="px-2 py-1 text-gray-400 hover:text-white transition flex-shrink-0"
        title="設定"
      >
        ⚙️
      </button>
    </div>

  </div>

  <!-- リサイズ用のボーダー（ドラッグする境界線） -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors z-10"
    on:mousedown={startResize}
  ></div>

  <!-- 右側のエディタエリア -->
  <div class="flex-1 overflow-hidden relative">
    {#if isResizing}
      <!-- ドラッグ中にエディタ(テキストエリア)がマウスの邪魔をするのを防ぐ透明カバー -->
      <div class="absolute inset-0 z-50 cursor-col-resize"></div>
    {/if}
    
    <Editor />
  </div>

</main>

<!-- 💥 設定モーダル -->
{#if isSettingsOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">設定</h2>
      
      <div class="mb-6">
        <label class="block text-sm text-gray-400 mb-2">エディタのフォント</label>
        <input 
          type="text" 
          class="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm outline-none focus:border-blue-500"
          bind:value={tempFont}
          placeholder="例: sans-serif, 'Meiryo', 'Consolas'"
        />
        <p class="text-xs text-gray-500 mt-1">PCにインストールされているフォント名を入力してください。</p>
      </div>

      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition" on:click={() => isSettingsOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm transition" on:click={saveSettings}>保存</button>
      </div>
    </div>
  </div>
{/if}