<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import Editor from '../components/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import { editorFont } from '../lib/stores';

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let workspaces: any[] = [];
  let currentIndex = 0;

  // --- メニューとモーダルの状態 ---
  let isListMenuOpen = false, isCreateModalOpen = false, isManageModalOpen = false, isImportLibraryModalOpen = false;
  let newListName = '', newListMode = 'Active', sourceLibraryId = 'none';
  let editingListIndex = 0, selectedLibraryId = '';

  // --- コンテキストアクション ---
  function getNodePath(node: any) { return node.type === 'Folder' ? node.original_path : node.path; }

  setContext('workspaceActions', {
    removeNode: (targetNode: any) => {
      if (!workspaces[currentIndex]) return;
      function filterOutNode(nodes: any[]) {
        return nodes.filter(n => n !== targetNode).map(n => {
          if (n.children) n.children = filterOutNode(n.children);
          return n;
        });
      }
      workspaces[currentIndex].nodes = filterOutNode(workspaces[currentIndex].nodes);
      workspaces = [...workspaces]; saveData();
    },
    pinNode: (targetNode: any) => {
      const ws = workspaces[currentIndex];
      if (!ws.pinned) ws.pinned = [];
      const path = getNodePath(targetNode);
      if (!ws.pinned.find((p:any) => p.path === path)) {
        ws.pinned.push({ item_type: targetNode.type, name: targetNode.name, path });
        workspaces = [...workspaces]; saveData();
      }
    },
    unpinNode: (targetNode: any) => unpin(getNodePath(targetNode)),
    checkIsPinned: (targetNode: any) => workspaces[currentIndex]?.pinned?.some((p:any) => p.path === getNodePath(targetNode)),
    // 💥 追加: 現在表示しているリストの「タブ挙動」を取得
    getClickBehavior: () => workspaces[currentIndex]?.open_in_new_tab || false,
    saveWorkspace: () => saveData() 
  });

  function unpin(path: string) {
    workspaces[currentIndex].pinned = workspaces[currentIndex].pinned.filter((p:any) => p.path !== path);
    workspaces = [...workspaces]; saveData();
  }

  // --- フォルダ更新関連 ---
  async function refreshTree(nodes: any[]): Promise<any[]> {
    const updatedNodes = [];
    for (let node of nodes) {
      if (node.type === 'Folder' && node.original_path) {
        try {
          const freshChildren: any[] = await invoke('read_directory', { path: node.original_path });
          if (node.children && node.children.length > 0) {
            const oldFolders = new Map(node.children.filter((c:any) => c.type === 'Folder').map((c:any) => [c.original_path, c]));
            for (let fresh of freshChildren) {
              if (fresh.type === 'Folder' && oldFolders.has(fresh.original_path)) {
                // 💥 変更した表示名を元に戻さず維持する
                fresh.name = oldFolders.get(fresh.original_path).name;
                fresh.children = oldFolders.get(fresh.original_path).children;
                fresh.children = await refreshTree(fresh.children);
              }
            }
          }
          node.children = freshChildren;
        } catch (e) {}
      }
      updatedNodes.push(node);
    }
    return updatedNodes;
  }
  async function handleRefresh() {
    if (!workspaces[currentIndex]) return;
    workspaces[currentIndex].nodes = await refreshTree(workspaces[currentIndex].nodes);
    workspaces = [...workspaces]; await saveData();
  }

  onMount(async () => {
    try {
      workspaces = await invoke('load_workspaces');
      if (workspaces.length === 0) {
        workspaces = [{ id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [], links: [], pinned: [], linked_libraries: [], is_flat: false }];
      } else {
        for (let ws of workspaces) ws.nodes = await refreshTree(ws.nodes);
        workspaces = [...workspaces];
      }
      const firstActive = workspaces.findIndex(w => w.category === 'Active');
      if(firstActive !== -1) currentIndex = firstActive;
    } catch (e) {}
  });

  async function saveData() { await invoke('save_workspaces', { workspaces }); }

  // --- リスト作成・管理関連 ---
  async function createNewWorkspace() {
    if (!newListName) return;
    let newNodes = [];
    if (newListMode === 'Active' && sourceLibraryId !== 'none') {
      const lib = workspaces.find(w => w.id === sourceLibraryId);
      if (lib) newNodes = JSON.parse(JSON.stringify(lib.nodes));
    }
    workspaces.push({ id: Date.now().toString(), name: newListName, category: newListMode, nodes: newNodes, links: [], pinned: [], linked_libraries: [], is_flat: false });
    if (newListMode === 'Active') currentIndex = workspaces.length - 1;
    workspaces = [...workspaces]; await saveData();
    isCreateModalOpen = false; newListName = '';
  }

  // 💥 ライブラリを「参照（リンク）」として追加する
  async function importLibrary() {
    if (!selectedLibraryId) return;
    const ws = workspaces[currentIndex];
    if (!ws.linked_libraries) ws.linked_libraries = [];
    
    if (!ws.linked_libraries.includes(selectedLibraryId)) {
      ws.linked_libraries.push(selectedLibraryId);
      workspaces = [...workspaces]; await saveData();
    }
    isImportLibraryModalOpen = false;
  }

  async function convertToLibrary() {
    const ws = workspaces[currentIndex];
    const newName = prompt("ライブラリとして保存する名前を入力してください", ws.name + " (コピー)");
    if(newName) {
      workspaces.push({ id: Date.now().toString(), name: newName, category: 'Library', nodes: JSON.parse(JSON.stringify(ws.nodes)), links: JSON.parse(JSON.stringify(ws.links||[])), pinned: JSON.parse(JSON.stringify(ws.pinned||[])), linked_libraries: [], is_flat: false });
      workspaces = [...workspaces]; await saveData(); alert("ライブラリに保存しました");
    }
    isListMenuOpen = false;
  }

  async function deleteEditingList() {
    // 💥 Tauriのネイティブダイアログを呼び出す
    const isYes = await tauriConfirm("本当に削除しますか？", { title: "確認", kind: "warning" });
    if (isYes) {
      workspaces.splice(editingListIndex, 1);
      if (currentIndex >= workspaces.length) currentIndex = Math.max(0, workspaces.length - 1);
      workspaces = [...workspaces]; await saveData();
      isManageModalOpen = false;
    }
  }

  function changeWorkspace(e: Event) { currentIndex = parseInt((e.target as HTMLSelectElement).value, 10); }

  async function addFolder() {
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') { workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "Folder", name: selectedPath.split(/[/\\]/).pop() || '新規フォルダ', original_path: selectedPath, children: [] }]; await saveData(); }
  }
  async function addFile() {
    const selectedPath = await openDialog({ directory: false, multiple: false });
    if (typeof selectedPath === 'string') { workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "File", name: selectedPath.split(/[/\\]/).pop() || '新規ファイル', path: selectedPath }]; await saveData(); }
  }

  // --- リンク機能 ---
  let isLinkModalOpen = false, editingLinkId: string | null = null, linkTitle = '', linkUrl = '';
  let linkContextMenu = { show: false, x: 0, y: 0, link: null as any };
  function openLinkModal(linkToEdit?: any) {
    if (linkToEdit) { editingLinkId = linkToEdit.id; linkTitle = linkToEdit.title; linkUrl = linkToEdit.url; } else { editingLinkId = null; linkTitle = ''; linkUrl = ''; }
    isLinkModalOpen = true;
  }
  async function saveLink() {
    if (!linkTitle || !linkUrl) return;
    if (!linkUrl.startsWith('http')) linkUrl = 'https://' + linkUrl;
    // 💥 修正: リスト管理画面で操作するため currentIndex を editingListIndex に変更
    const ws = workspaces[editingListIndex];
    if (!ws.links) ws.links = [];
    if (editingLinkId) {
      const idx = ws.links.findIndex((l:any) => l.id === editingLinkId);
      if (idx !== -1) ws.links[idx] = { id: editingLinkId, title: linkTitle, url: linkUrl };
    } else { ws.links.push({ id: Date.now().toString(), title: linkTitle, url: linkUrl }); }
    workspaces = [...workspaces]; await saveData(); isLinkModalOpen = false;
  }
  async function deleteLink(id: string) { workspaces[editingListIndex].links = workspaces[editingListIndex].links.filter((l:any) => l.id !== id); workspaces = [...workspaces]; await saveData(); closeLinkMenu(); }
  function handleLinkContextMenu(e: MouseEvent, link: any) { e.preventDefault(); linkContextMenu = { show: true, x: e.clientX, y: e.clientY, link }; }
  function closeLinkMenu() { linkContextMenu.show = false; }

  // 設定
  let isSettingsOpen = false; let tempFont = '';
  function openSettings() { tempFont = $editorFont; isSettingsOpen = true; }
  function saveSettings() { $editorFont = tempFont; isSettingsOpen = false; }
</script>

<svelte:window on:mousemove={doResize} on:mouseup={stopResize} on:click={() => isListMenuOpen = false} />

<main class="h-screen w-screen flex bg-gray-900 text-gray-200 select-none">
  
  <div class="bg-gray-800 flex flex-col" style="width: {sidebarWidth}px">
    
    <div class="p-3 border-b border-gray-700 font-bold flex justify-between items-center text-gray-300">
      <span class="truncate pr-2">{workspaces[currentIndex]?.name || 'リスト'}</span>
      <div class="flex gap-2 shrink-0">
        <button on:click={handleRefresh} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">↻</button>
        <button on:click={addFile} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">📄</button>
        <button on:click={addFolder} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">📁</button>
      </div>
    </div>
    
    <div class="flex-1 p-2 overflow-auto">
      {#if workspaces[currentIndex]?.pinned && workspaces[currentIndex].pinned.length > 0}
        <div class="mb-2">
          <div class="text-xs font-bold text-gray-500 mb-1 pl-1">📌 ピン留め</div>
          {#each workspaces[currentIndex].pinned as pin}
            <div class="flex items-center justify-between group">
              <div class="flex-1 overflow-hidden"><TreeNode node={{ type: pin.item_type, name: pin.name, path: pin.path, original_path: pin.path, children: [] }} /></div>
              <button on:click={() => unpin(pin.path)} class="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 px-1">✕</button>
            </div>
          {/each}
        </div>
        <hr class="border-gray-700 border-dashed mb-2">
      {/if}

     <div>
        {#if workspaces.length > 0 && workspaces[currentIndex]}
          {#each workspaces[currentIndex].nodes as node}
            <!-- 💥 ワークスペースのものは isReadonly={false} を渡す -->
            <TreeNode {node} isReadonly={false} />
          {/each}
        {/if}
      </div>

      <!-- 💥 参照されているライブラリを一括表示 -->
      {#if workspaces[currentIndex]?.linked_libraries?.length > 0}
        {#each workspaces[currentIndex].linked_libraries as libId}
          {@const lib = workspaces.find(w => w.id === libId)}
          {#if lib}
            {#if lib.is_flat}
              {#each lib.nodes as node}
                <!-- 💥 ライブラリのものは isReadonly={true} を渡す -->
                <TreeNode node={{ ...node, is_library_root: node.type === 'Folder' }} isReadonly={true} />
              {/each}
            {:else}
              <TreeNode node={{ type: 'Folder', name: lib.name, original_path: null, children: lib.nodes, is_library_root: true }} isReadonly={true} />
            {/if}
          {/if}
        {/each}
      {/if}

    </div>

    <!-- リンク固定エリア -->
    {#if workspaces[currentIndex]}
      <div class="border-t border-gray-700 flex flex-col shrink-0">
        <!-- <div class="flex justify-between items-center p-2 text-xs font-bold text-gray-400">
          <span>🔗 リンク</span> 
        </div>-->
        <div class="p-2 overflow-y-auto space-y-1 max-h-[150px]">
          {#each workspaces[currentIndex].links || [] as link}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="text-sm text-blue-400 hover:text-blue-300 hover:underline cursor-pointer truncate pl-1" on:click={() => openUrl(link.url)} on:contextmenu={(e) => handleLinkContextMenu(e, link)}>{link.title}</div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- UI下部 -->
    <div class="p-2 border-t border-gray-700 bg-gray-800 flex items-center gap-1 relative">
      <select class="w-32 bg-gray-700 text-xs text-gray-200 rounded py-1 px-1 outline-none border border-gray-600" value={currentIndex} on:change={changeWorkspace}>
        {#each workspaces.map((w, i) => ({...w, originalIndex: i})).filter(w => w.category === 'Active') as ws}
          <option value={ws.originalIndex}>{ws.name}</option>
        {/each}
      </select>
      
      <button on:click|stopPropagation={() => isListMenuOpen = !isListMenuOpen} class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded">≡</button>

      {#if isListMenuOpen}
        <div class="absolute bottom-10 left-36 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 py-1 w-48 text-sm">
          <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isListMenuOpen = false; isCreateModalOpen = true; }}>📝 リスト作成</button>
          <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isListMenuOpen = false; editingListIndex = currentIndex; isManageModalOpen = true; }}>⚙️ リスト管理</button>
          <hr class="border-gray-600 my-1">
          <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isListMenuOpen = false; isImportLibraryModalOpen = true; }}>📚 ライブラリを追加</button>
          <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={convertToLibrary}>📦 ライブラリ化</button>
        </div>
      {/if}
      <div class="flex-1"></div>
      <button on:click={openSettings} class="px-2 py-1 text-gray-400 hover:text-white">⚙️</button>
    </div>
  </div>

  <div class="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize z-10" on:mousedown={startResize}></div>
  <div class="flex-1 overflow-hidden relative">
    {#if isResizing}<div class="absolute inset-0 z-50 cursor-col-resize"></div>{/if}
    <Editor />
  </div>
</main>

<!-- 💥 各種モーダル（すべてに text-gray-200 を適用） -->

<!-- 1. リスト作成 -->
{#if isCreateModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">リストを作成</h2>
      <div class="flex gap-4 mb-4">
        <label class="flex items-center text-sm cursor-pointer"><input type="radio" bind:group={newListMode} value="Active" class="mr-2">ワークスペース</label>
        <label class="flex items-center text-sm cursor-pointer"><input type="radio" bind:group={newListMode} value="Library" class="mr-2">ライブラリ</label>
      </div>
      <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none mb-4" bind:value={newListName} placeholder="新しい名前" />
      {#if newListMode === 'Active'}
        <select class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm mb-4" bind:value={sourceLibraryId}>
          <option value="none">空から作成 (ライブラリを使わない)</option>
          {#each workspaces.filter(w => w.category === 'Library') as lib}
            <option value={lib.id}>{lib.name} からインポート</option>
          {/each}
        </select>
      {/if}
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isCreateModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={createNewWorkspace}>作成</button>
      </div>
    </div>
  </div>
{/if}

<!-- 2. リスト管理 -->
{#if isManageModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-[500px]">
      <h2 class="text-lg font-bold mb-4">リスト管理</h2>
      <div class="flex gap-2 mb-4">
        <select class="flex-1 bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" bind:value={editingListIndex}>
          <optgroup label="ワークスペース">{#each workspaces.map((w, i) => ({...w, i})).filter(w => w.category === 'Active') as ws}<option value={ws.i}>{ws.name}</option>{/each}</optgroup>
          <optgroup label="ライブラリ">{#each workspaces.map((w, i) => ({...w, i})).filter(w => w.category === 'Library') as ws}<option value={ws.i}>{ws.name}</option>{/each}</optgroup>
        </select>
        <button on:click={deleteEditingList} class="px-3 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded text-sm transition font-bold">削除</button>
      </div>

      {#if workspaces[editingListIndex]}
        <div class="bg-gray-900 p-4 rounded border border-gray-700 mb-6 max-h-[50vh] overflow-y-auto">
          <input type="text" class="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none mb-4" bind:value={workspaces[editingListIndex].name} on:change={saveData} />
          
          <div class="flex gap-4 mb-4">
            <label class="flex items-center text-sm cursor-pointer"><input type="radio" bind:group={workspaces[editingListIndex].category} value="Active" on:change={saveData} class="mr-2">ワークスペース</label>
            <label class="flex items-center text-sm cursor-pointer"><input type="radio" bind:group={workspaces[editingListIndex].category} value="Library" on:change={saveData} class="mr-2">ライブラリ</label>
          </div>

          <!-- 💥 ファイルクリック動作設定（ワークスペースのみ） -->
          {#if workspaces[editingListIndex].category === 'Active'}
            <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
              <div class="text-xs text-gray-400 mb-2">ファイルをクリックした時の動作</div>
              <label class="flex items-center text-sm cursor-pointer mb-2">
                <input type="radio" bind:group={workspaces[editingListIndex].open_in_new_tab} value={false} on:change={saveData} class="mr-2 text-blue-500">
                今開いているタブを上書きする
              </label>
              <label class="flex items-center text-sm cursor-pointer">
                <input type="radio" bind:group={workspaces[editingListIndex].open_in_new_tab} value={true} on:change={saveData} class="mr-2 text-blue-500">
                新しいタブで開く
              </label>
            </div>
          {/if}

          <!-- 💥 ライブラリ固有の設定 -->
          {#if workspaces[editingListIndex].category === 'Library'}
            <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
              <label class="flex items-center text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" bind:checked={workspaces[editingListIndex].is_flat} on:change={saveData} class="mr-2">
                このライブラリをフォルダにまとめず、直接中身を展開して表示する
              </label>
            </div>
          {/if}

          <!-- 💥 ワークスペース固有の設定（リンク解除） -->
          {#if workspaces[editingListIndex].category === 'Active' && workspaces[editingListIndex].linked_libraries?.length > 0}
            <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
              <div class="text-xs text-gray-400 mb-2">リンク中のライブラリ</div>
              {#each workspaces[editingListIndex].linked_libraries as libId}
                {@const lib = workspaces.find(w => w.id === libId)}
                {#if lib}
                  <div class="flex items-center justify-between text-sm text-gray-300 mb-1">
                    <span>📚 {lib.name}</span>
                    <button class="text-xs text-red-400 hover:text-red-300" on:click={() => { workspaces[editingListIndex].linked_libraries = workspaces[editingListIndex].linked_libraries.filter(id => id !== libId); workspaces = [...workspaces]; saveData(); }}>解除</button>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}

          <!-- 💥 リンク管理（移設） -->
          <div class="p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs text-gray-400">🔗 リンク</span>
              <button on:click={() => openLinkModal()} class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs">＋ 追加</button>
            </div>
            <div class="space-y-2">
              {#each workspaces[editingListIndex].links || [] as link}
                <div class="flex items-center justify-between text-sm text-gray-300 bg-gray-900 p-2 rounded">
                  <span class="truncate flex-1 pr-2">{link.title}</span>
                  <div class="flex gap-3 shrink-0">
                    <button class="text-xs text-blue-400 hover:text-blue-300" on:click={() => openLinkModal(link)}>編集</button>
                    <button class="text-xs text-red-400 hover:text-red-300" on:click={() => deleteLink(link.id)}>削除</button>
                  </div>
                </div>
              {:else}
                <div class="text-xs text-gray-500 text-center py-2">リンクはありません</div>
              {/each}
            </div>
          </div>

        </div>
      {/if}
      <div class="flex justify-end"><button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isManageModalOpen = false}>閉じる</button></div>
    </div>
  </div>
{/if}

<!-- 3. ライブラリ追加 -->
{#if isImportLibraryModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">ライブラリを追加</h2>
      <select class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm mb-4" bind:value={selectedLibraryId}>
        <option value="" disabled selected>ライブラリを選択</option>
        {#each workspaces.filter(w => w.category === 'Library') as lib}<option value={lib.id}>{lib.name}</option>{/each}
      </select>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isImportLibraryModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={importLibrary}>追加</button>
      </div>
    </div>
  </div>
{/if}

<!-- リンク・設定モーダル（既存のまま文字色だけ修正） -->
{#if linkContextMenu.show}
  <div class="fixed inset-0 z-40" on:click={closeLinkMenu} on:contextmenu|preventDefault={closeLinkMenu}></div>
  <div class="fixed bg-gray-800 border border-gray-600 rounded shadow-xl z-50 py-1 w-32 text-gray-200" style="left: {linkContextMenu.x}px; top: {linkContextMenu.y}px;">
    <button class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-700" on:click={() => { openLinkModal(linkContextMenu.link); closeLinkMenu(); }}>編集</button>
    <button class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700" on:click={() => deleteLink(linkContextMenu.link.id)}>削除</button>
  </div>
{/if}

{#if isLinkModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">{editingLinkId ? 'リンクを編集' : 'リンクを追加'}</h2>
      <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm mb-4" bind:value={linkTitle} placeholder="表示テキスト" />
      <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm mb-6" bind:value={linkUrl} placeholder="URL" />
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isLinkModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={saveLink}>保存</button>
      </div>
    </div>
  </div>
{/if}

{#if isSettingsOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">設定</h2>
      <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm mb-6" bind:value={tempFont} placeholder="フォント名" />
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isSettingsOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={saveSettings}>保存</button>
      </div>
    </div>
  </div>
{/if}