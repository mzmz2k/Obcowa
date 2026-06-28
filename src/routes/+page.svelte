<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { getCurrentWindow } from '@tauri-apps/api/window'; 
  import Editor from '../components/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import { editorFont, openTabs, activeTabId, currentWorkspaceIndex, openSearchTab, registeredTags } from '../lib/stores';

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let workspaces: any[] = [];
  let currentIndex = 0
  $: $currentWorkspaceIndex = currentIndex;
  let isInitialized = false; 

   // 💥 追加: 初期化完了後、ワークスペース名が変わるたびにウィンドウのタイトルを書き換える
  $: if (isInitialized && workspaces[currentIndex]) {
    getCurrentWindow().setTitle(workspaces[currentIndex].name).catch(() => {});
  }

  // --- メニューとモーダルの状態 ---
  let isListMenuOpen = false, isCreateModalOpen = false, isManageModalOpen = false, isImportLibraryModalOpen = false;
  // 💥 追加: フォルダ追加メニューとスマートフォルダ関連
  let isAddFolderMenuOpen = false, isSmartFolderModalOpen = false;
  let sfName = '', sfTarget = '', sfMatch = 'AND', sfKeep = true;
  let sfConds: any[] = [];
  let editingSmartNode: any = null;

  let newListName = '', newListMode = 'Active', sourceLibraryId = 'none';
  let editingListIndex = 0, selectedLibraryId = '';

    // --- タグ・新規作成用の状態変数 ---
  let isNewFileModalOpen = false;
  let newFileTargetDir = '';
  let newFileName = '新しいファイル.md';
  let selectedTagForNew = '';
  let newFileCallback: (() => void) | null = null;

  let newTagInput = '';
  let selectedTagToRemove = '';

    // 💥 追加: ファイル名（拡張子の前）だけを選択状態にするアクション
  function selectBaseName(node: HTMLInputElement) {
    setTimeout(() => {
      node.focus();
      const idx = node.value.lastIndexOf('.');
      if (idx > 0) node.setSelectionRange(0, idx);
      else node.select();
    }, 10);
  }

  // 💥 追加: タグの追加と削除
  function addTag() {
    const t = newTagInput.trim();
    if (t && !$registeredTags.includes(t)) {
      $registeredTags = [...$registeredTags, t];
      localStorage.setItem('registeredTags', JSON.stringify($registeredTags));
      newTagInput = '';
    }
  }
  function removeTag() {
    if (selectedTagToRemove) {
      $registeredTags = $registeredTags.filter(t => t !== selectedTagToRemove);
      localStorage.setItem('registeredTags', JSON.stringify($registeredTags));
      selectedTagToRemove = '';
    }
  }

  // 💥 追加: ファイル作成の実行
  async function createNewFileConfirm() {
    if (!newFileName.trim()) return;
    try {
      await invoke('create_new_file', { dirPath: newFileTargetDir, fileName: newFileName, insertTag: selectedTagForNew });
      if (newFileCallback) newFileCallback();
      isNewFileModalOpen = false;
    } catch (e) {
      alert("ファイル作成に失敗しました: " + e);
    }
  }

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
    saveWorkspace: () => saveData() ,
    // 💥 新規追加: ツリーから編集モードを呼び出す
    editSmartFolder: (node: any) => {
      editingSmartNode = node;
      sfName = node.name;
      sfTarget = node.smart_rules.target_dir;
      sfMatch = node.smart_rules.match_type;
      sfKeep = node.smart_rules.keep_structure;
      // 条件はコピーして渡す（キャンセル時に反映させないため）
      sfConds = JSON.parse(JSON.stringify(node.smart_rules.conditions));
      
      // 💥 過去のデータで match_mode が無い場合は補完する
      sfConds.forEach(c => {
        if (c.cond_type === 'Tag' && !c.match_mode) c.match_mode = 'contains';
      });
      isSmartFolderModalOpen = true;
    },
    openNewFileModal: (dirPath: string, callback: () => void) => {
      newFileTargetDir = dirPath;
      newFileCallback = callback;
      newFileName = '新しいファイル.md';
      selectedTagForNew = '';
      isNewFileModalOpen = true;
    }
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
        
        // 💥 変更: スマートフォルダの抽出処理を裏に回し、全体の展開をブロックしないようにする
        if (node.smart_rules) {
          invoke('evaluate_smart_folder', { rules: node.smart_rules }).then(children => {
            node.children = children as any[];
            workspaces = [...workspaces]; // 抽出が終わり次第、UIに反映
          }).catch(() => {});
        } else {
          // 普通のフォルダの場合（これ自体は一瞬で終わる）
          try {
            let freshChildren: any[] = await invoke('read_directory', { path: node.original_path });
            
            const oldFolders = new Map();
            if (node.children) {
              for (const c of node.children) {
                if (c.type === 'Folder') oldFolders.set(c.original_path, c);
              }
            }

            for (let fresh of freshChildren) {
              if (fresh.type === 'Folder') {
                if (oldFolders.has(fresh.original_path)) {
                  const old = oldFolders.get(fresh.original_path);
                  fresh.name = old.name;
                  fresh.children = old.children || [];
                } else {
                  fresh.children = [];
                }
              }
            }
            node.children = await refreshTree(freshChildren);
          } catch (e) {}
        }
      }
      updatedNodes.push(node);
    }
    return updatedNodes;
  }

  // 💥 追加: スマートフォルダ操作関数
  function changeCondType(idx: number, type: string) {
    // 💥 match_mode: 'contains' を追加
    if (type === 'Tag') sfConds[idx] = { cond_type: 'Tag', tag: '', match_mode: 'contains', include_inline: false, is_exclude: false };
    else sfConds[idx] = { cond_type: 'Date', date_type: 'updated', limit: 10 };
  }
  async function selectSfTarget() {
    const path = await openDialog({ directory: true });
    if (typeof path === 'string') sfTarget = path;
  }
  async function saveSmartFolder() {
    if (!sfName || !sfTarget) return alert("名前と抽出元フォルダを指定してください");
    const rules = { target_dir: sfTarget, match_type: sfMatch, conditions: sfConds, keep_structure: sfKeep };
    try {
      const children = await invoke('evaluate_smart_folder', { rules });
      
      if (editingSmartNode) {
        // 編集のとき
        editingSmartNode.name = sfName;
        editingSmartNode.smart_rules = rules;
        editingSmartNode.children = children; // 条件が変わったので中身も更新
      } else {
        // 新規作成のとき
        workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "Folder", name: sfName, original_path: sfTarget, children, smart_rules: rules }];
      }
      
      workspaces = [...workspaces];
      await saveData();
      isSmartFolderModalOpen = false;
    } catch (e) { alert("抽出に失敗しました: " + e); }
  }

  async function handleRefresh() {
    if (!workspaces[currentIndex]) return;
    
    // 1. 現在のワークスペースのフォルダ構成を更新
    workspaces[currentIndex].nodes = await refreshTree(workspaces[currentIndex].nodes);

    // 2. リンクされているライブラリのフォルダ構成も一緒に更新
    const linkedLibs = workspaces[currentIndex].linked_libraries;
    if (linkedLibs && linkedLibs.length > 0) {
      for (const libId of linkedLibs) {
        const libIndex = workspaces.findIndex(w => w.id === libId);
        if (libIndex !== -1) {
          workspaces[libIndex].nodes = await refreshTree(workspaces[libIndex].nodes);
        }
      }
    }
    
    workspaces = [...workspaces]; 
    await saveData();
  }

  onMount(async () => {
    // 💥 追加: ローカルストレージからタグ一覧を復元する
    try {
      const savedTags = localStorage.getItem('registeredTags');
      if (savedTags) registeredTags.set(JSON.parse(savedTags));
    } catch (e) {}

    try {
      workspaces = await invoke('load_workspaces');
      if (workspaces.length === 0) {
        workspaces = [{ id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [], links: [], pinned: [], linked_libraries: [], is_flat: false, open_in_new_tab: false, saved_tabs: [], active_tab_id: null }];
      } 
      
      // 💥 変更: 【一番最初】に開くべきワークスペースを決定する（チラつき防止）
      const params = new URLSearchParams(window.location.search);
      const wsParam = params.get('ws');
      if (wsParam !== null) {
        currentIndex = parseInt(wsParam, 10);
      } else {
        const firstActive = workspaces.findIndex(w => w.category === 'Active');
        if(firstActive !== -1) currentIndex = firstActive;
      }

      // 💥 変更: ツリーの最新化を待たずに、保存されていた状態ですぐにタブを復元する
      const ws = workspaces[currentIndex];
      if (ws && ws.saved_tabs && ws.saved_tabs.length > 0) {
        const restored = [];
        for (const tab of ws.saved_tabs) {
          let content = "";
          if (tab.path) {
            try {
              const bytes: number[] = await invoke('read_file_content', { path: tab.path });
              const uint8Array = new Uint8Array(bytes);
              try { content = new TextDecoder('utf-8', { fatal: true }).decode(uint8Array); } 
              catch { content = new TextDecoder('shift-jis').decode(uint8Array); }
            } catch(e) {}
          }
          restored.push({ id: tab.id, path: tab.path, title: tab.title, content, isEditing: tab.isEditing, isDirty: false });
        }
        openTabs.set(restored);
        activeTabId.set(ws.active_tab_id || restored[0].id);
      }
      
      // 💥 変更: この時点で画面をユーザーに見せる
      isInitialized = true; 

      // 💥 変更: 画面を表示し終わった後、バックグラウンドでフォルダの最新化を行う
      (async () => {
        for (let ws of workspaces) {
          ws.nodes = await refreshTree(ws.nodes);
        }
        workspaces = [...workspaces];
      })();
      
    } catch (e) {}
  });

// 💥 タブの状態が変わったら自動でワークスペースに記録（初期化完了後のみ動くように修正）
$: if (isInitialized && workspaces.length > 0 && workspaces[currentIndex]) {
const tabsToSave = $openTabs.map(t => ({ id: t.id, path: t.path, title: t.title, isEditing: t.isEditing }));
    const currentWs = workspaces[currentIndex];
    
    // 無限ループを防ぐため、変化があった時のみ保存
    if (JSON.stringify(currentWs.saved_tabs) !== JSON.stringify(tabsToSave) || currentWs.active_tab_id !== $activeTabId) {
      currentWs.saved_tabs = tabsToSave;
      currentWs.active_tab_id = $activeTabId;
      saveData();
    }
  }

  // 💥 複数ウィンドウでのファイル書き込み競合を防ぐため、保存直前に最新を読み込んでマージ
  async function saveData() {
    try {
      const latestWorkspaces: any[] = await invoke('load_workspaces');
      if (latestWorkspaces.length > 0 && latestWorkspaces[currentIndex]) {
        latestWorkspaces[currentIndex] = workspaces[currentIndex];
        await invoke('save_workspaces', { workspaces: latestWorkspaces });
      } else {
        await invoke('save_workspaces', { workspaces });
      }
    } catch (e) {
      await invoke('save_workspaces', { workspaces });
    }
  }

  // --- リスト作成・管理関連 ---
  async function createNewWorkspace() {
    if (!newListName) return;
    
    // 💥 変更: 常に category: 'Active' で、空の状態から作成する
    workspaces.push({ 
      id: Date.now().toString(), 
      name: newListName, 
      category: 'Active', 
      nodes: [], 
      links: [], 
      pinned: [], 
      linked_libraries: [], 
      is_flat: false 
    });
    
    // 作成したリストを選択状態にする
    currentIndex = workspaces.length - 1;
    workspaces = [...workspaces]; 
    await saveData();
    
    isCreateModalOpen = false; 
    newListName = '';
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

  function changeWorkspace(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedIndex = parseInt(target.value, 10);
    
    // 現在のウィンドウは切り替えず、セレクトボックスの表示を元に戻す
    target.value = currentIndex.toString();
    if (selectedIndex === currentIndex) return;

    // 別のワークスペースを「新しいウィンドウ」として開く
    const label = `ws-${Date.now()}`;
    const webview = new WebviewWindow(label, {
      url: `/?ws=${selectedIndex}`,
      title: workspaces[selectedIndex].name,
      width: 1000,
      height: 800
    });

    // 💥 万が一ウィンドウが開けなかった時にエラーメッセージを出す
    webview.once('tauri://error', function (e) {
      console.error('ウィンドウ生成エラー:', e);
      alert('新しいウィンドウを開けませんでした。パーミッション設定を確認してください。');
    });
  }

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

<svelte:window on:mousemove={doResize} on:mouseup={stopResize} on:click={() => { isListMenuOpen = false; isAddFolderMenuOpen = false; }} />
<main class="h-screen w-screen flex bg-gray-900 text-gray-200 select-none">
  
  <div class="bg-gray-800 flex flex-col" style="width: {sidebarWidth}px">

    <div class="p-3 border-b border-gray-700 font-bold flex justify-between items-center text-gray-300">
      <span class="truncate pr-2">{workspaces[currentIndex]?.name || 'リスト'}</span>
      <div class="flex gap-2 shrink-0 relative">
        <button on:click={handleRefresh} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">↻</button>
        
        <!-- 💥 変更: 検索ボタンに変更 -->
        <button on:click={openSearchTab} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" title="検索">🔍</button>
        
        <!-- フォルダ追加メニュー -->
        <button on:click|stopPropagation={() => isAddFolderMenuOpen = !isAddFolderMenuOpen} class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">📁</button>
        {#if isAddFolderMenuOpen}
          <div class="absolute top-8 right-0 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 py-1 w-40 text-sm font-normal">
            <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isAddFolderMenuOpen = false; addFolder(); }}>普通のフォルダ</button>
            
            <!-- 💥 追加: ファイル追加をここに移動 -->
            <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isAddFolderMenuOpen = false; addFile(); }}>📄 ファイルを追加</button>
            
            <!-- 💥 変更なし（順番がファイル追加の下になりました） -->
            <button class="block w-full text-left px-4 py-2 hover:bg-gray-700" on:click={() => { isAddFolderMenuOpen = false; sfName=''; sfTarget=''; sfConds=[]; editingSmartNode=null; isSmartFolderModalOpen = true; }}>🔍 条件で抽出</button>
          </div>
        {/if}
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
      
      <!-- 💥 変更: ラジオボタンとプルダウンを削除し、マージン(mb-6)を調整 -->
      <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none mb-6" bind:value={newListName} placeholder="新しい名前" on:keydown={(e) => e.key === 'Enter' && createNewWorkspace()} />
      
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
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-[500px]">
      <h2 class="text-lg font-bold mb-4">設定</h2>
      
      <div class="mb-6">
        <div class="text-sm text-gray-400 mb-1">フォント名</div>
        <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm" bind:value={tempFont} placeholder="フォント名" />
      </div>

      <hr class="border-gray-700 mb-6">

      <div class="mb-6">
        <div class="text-sm text-gray-400 mb-2">タグの管理</div>
        
        <div class="flex gap-2 mb-4">
          <input type="text" class="flex-1 bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" bind:value={newTagInput} placeholder="新しいタグ名を入力" on:keydown={(e) => e.key === 'Enter' && addTag()} />
          <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={addTag}>登録</button>
        </div>

        <div class="flex gap-2">
          <select class="flex-1 bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" bind:value={selectedTagToRemove}>
            <option value="" disabled selected>登録済みのタグ一覧</option>
            {#each $registeredTags as tag}
              <option value={tag}>{tag}</option>
            {/each}
          </select>
          <button class="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded text-sm" on:click={removeTag}>削除</button>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isSettingsOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={saveSettings}>保存</button>
      </div>
    </div>
  </div>
{/if}

<!-- 💥 追加: 新規ファイル作成モーダル -->
{#if isNewFileModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-96">
      <h2 class="text-lg font-bold mb-4">新規ファイル作成</h2>
      
      <div class="mb-4">
        <div class="text-xs text-gray-400 mb-1">ファイル名</div>
        <input 
          type="text" 
          class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" 
          bind:value={newFileName} 
          use:selectBaseName
          on:keydown={(e) => e.key === 'Enter' && createNewFileConfirm()}
        />
      </div>

      <div class="mb-6">
        <div class="text-xs text-gray-400 mb-1">タグの挿入 (オプション)</div>
        <select class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" bind:value={selectedTagForNew}>
          <option value="">指定しない</option>
          {#each $registeredTags as tag}
            <option value={tag}>{tag}</option>
          {/each}
        </select>
      </div>

      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isNewFileModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={createNewFileConfirm}>作成</button>
      </div>
    </div>
  </div>
{/if}

<!-- 💥 条件で抽出（スマートフォルダ）モーダル -->
{#if isSmartFolderModalOpen}
<div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center text-gray-200">
    <div class="bg-gray-800 p-6 rounded shadow-lg border border-gray-600 w-[550px] max-h-[90vh] overflow-y-auto">
      <!-- 💥 タイトルを切り替え -->
      <h2 class="text-lg font-bold mb-4">{editingSmartNode ? '条件を編集' : '条件で抽出'}</h2>
      
      <div class="mb-4 space-y-2">
        <input type="text" class="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded p-2 text-sm outline-none" bind:value={sfName} placeholder="リストに表示する名前" />
        <div class="flex gap-2">
          <input type="text" class="flex-1 bg-gray-700 text-gray-400 border border-gray-600 rounded p-2 text-sm" value={sfTarget} readonly placeholder="抽出元のフォルダ" />
          <button on:click={selectSfTarget} class="px-3 bg-gray-700 hover:bg-gray-600 rounded text-sm border border-gray-600">選択</button>
        </div>
      </div>

      <div class="bg-gray-900 p-4 rounded border border-gray-700 mb-4">
        <div class="flex justify-between items-center mb-3">
          <select class="bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={sfMatch}>
            <option value="AND">すべての条件を満たす (AND)</option>
            <option value="OR">いずれかの条件を満たす (OR)</option>
          </select>
          <button class="text-sm px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" on:click={() => sfConds.length < 5 && sfConds.push({ cond_type: 'Tag', tag: '', include_inline: false, is_exclude: false }) && (sfConds = sfConds)} disabled={sfConds.length >= 5}>＋ 条件を追加</button>
        </div>

        <div class="space-y-3">
          {#each sfConds as cond, i}
            <div class="flex flex-col gap-2 p-3 bg-gray-800 border border-gray-600 rounded relative">
              <button class="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs" on:click={() => { sfConds.splice(i, 1); sfConds = sfConds; }}>✕</button>
              
              <select class="w-48 bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" value={cond.cond_type} on:change={(e) => changeCondType(i, e.target.value)}>
                <option value="Tag">タグ</option>
                <option value="Date">作成日 / 更新日</option>
              </select>

              {#if cond.cond_type === 'Tag'}
                <div class="flex items-center gap-2">
                  <input type="text" class="flex-1 bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={cond.tag} placeholder="タグ名 (例: memo)" />
                  
                  <!-- 💥 マッチモードの選択肢を追加 -->
                  <select class="w-24 bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={cond.match_mode}>
                    <option value="contains">部分一致</option>
                    <option value="exact">完全一致</option>
                    <option value="starts">前方一致</option>
                    <option value="ends">後方一致</option>
                  </select>

                  <select class="w-20 bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={cond.is_exclude}>
                    <option value={false}>がある</option><option value={true}>がない</option>
                  </select>
                </div>
                <label class="flex items-center text-xs text-gray-400 cursor-pointer"><input type="checkbox" bind:checked={cond.include_inline} class="mr-2">本文中のタグも含める</label>
              {:else}
                <div class="flex items-center gap-2">
                  <select class="bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={cond.date_type}>
                    <option value="created">作成日</option><option value="updated">更新日</option>
                  </select>
                  <span class="text-sm">が新しいもの</span>
                  <input type="number" class="w-16 bg-gray-700 text-gray-200 border border-gray-600 rounded p-1 text-sm outline-none" bind:value={cond.limit} min="1" max="100" />
                  <span class="text-sm">件</span>
                </div>
              {/if}
            </div>
          {/each}
          {#if sfConds.length === 0}<div class="text-xs text-gray-500 text-center py-2">条件がありません（すべて抽出されます）</div>{/if}
        </div>
      </div>

      <label class="flex items-center text-sm cursor-pointer mb-6 text-gray-300">
        <input type="checkbox" bind:checked={sfKeep} class="mr-2"> 抽出したものの元のフォルダ構成を維持する
      </label>

 <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" on:click={() => isSmartFolderModalOpen = false}>キャンセル</button>
        <!-- 💥 ボタンの文字と呼び出す関数を切り替え -->
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" on:click={saveSmartFolder}>{editingSmartNode ? '保存して更新' : '抽出して追加'}</button>
      </div>
    </div>
  </div>
{/if}