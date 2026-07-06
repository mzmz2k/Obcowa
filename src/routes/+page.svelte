<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { getCurrentWindow } from '@tauri-apps/api/window'; 
  import Editor from '../components/Editor/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import SettingsModal from '../components/Settings/SettingsModal.svelte';
  import NewFileModal from '../components/Modals/NewFileModal.svelte';
  import SmartFolderModal from '../components/Modals/SmartFolderModal.svelte';
  import WorkspaceManager from '../components/Modals/WorkspaceManager.svelte';
  import SidebarHeader from '../components/Sidebar/SidebarHeader.svelte';
  import { activeTheme, initTheme, applyThemeToRoot } from '../lib/settings/theme';
  import { editorFont, openTabs, activeTabId, currentWorkspaceIndex, openSearchTab, registeredTags, imageFolderPath } from '../lib/stores';
  import { cloneNodeAsIndependent } from '../lib/library';
  import { Pin, X, Menu, SquarePen, Settings, Library, Archive, Link } from 'lucide-svelte';

 

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let workspaces: any[] = [];
  let currentIndex = 0;
  $: $currentWorkspaceIndex = currentIndex;

  let isInitialized = false; 

  $: if (isInitialized && workspaces[currentIndex]) {
    getCurrentWindow().setTitle(workspaces[currentIndex].name).catch(() => {});
    
    // 💥 追加: ワークスペースを切り替えたら、そのワークスペースのフォント設定を読み込む
    $editorFont = workspaces[currentIndex].editor_font || 'sans-serif';
  }

  // --- メニューとモーダルの状態 ---
  let isListMenuOpen = false, isCreateModalOpen = false, isManageModalOpen = false, isImportLibraryModalOpen = false;
  // 💥フォルダ追加メニューとスマートフォルダ関連
  let isAddFolderMenuOpen = false, isSmartFolderModalOpen = false;
  let editingSmartNode: any = null;

  let editingListIndex = 0;

    // --- タグ・新規作成用の状態変数 ---
  let isNewFileModalOpen = false;
  let newFileTargetDir = '';
  let newFileCallback: (() => void) | null = null;

  function openSettings() {
      isSettingsOpen = true;
  }


   // 💥 追加: ソート用の並び替え関数
  function getSortedNodes(nodes: any[], sortBy = 'name', sortOrder = 'asc') {
    if (!nodes) return [];
    return [...nodes].sort((a, b) => {
      // フォルダは常に上に配置
      const isDirA = a.type === 'Folder';
      const isDirB = b.type === 'Folder';
      if (isDirA !== isDirB) return isDirA ? -1 : 1;
      
      let comp = 0;
      if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
      else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
      else comp = a.name.localeCompare(b.name);
      
      return sortOrder === 'asc' ? comp : -comp;
    });
  }


  // --- コンテキストアクション ---
  function getNodePath(node: any) { return node.type === 'Folder' ? node.original_path : node.path; }

  setContext('workspaceActions', {
    removeNode: (targetNode: any, ownerId: string) => {
      const wsIndex = workspaces.findIndex(w => w.id === ownerId);
      if (wsIndex === -1) return;

      function filterOutNode(nodes: any[]) {
        return nodes.filter(n => n !== targetNode).map(n => {
          if (n.children) n.children = filterOutNode(n.children);
          return n;
        });
      }
      workspaces[wsIndex].nodes = filterOutNode(workspaces[wsIndex].nodes);
      // 💥 変更: saveData(true) に変更
      workspaces = [...workspaces]; saveData(true);
    },
    pinNode: (targetNode: any) => {
      const ws = workspaces[currentIndex];
      if (!ws.pinned) ws.pinned = [];
      const path = getNodePath(targetNode);
      if (!ws.pinned.find((p:any) => p.path === path)) {
        ws.pinned.push({ item_type: targetNode.type, name: targetNode.name, path });
        workspaces = [...workspaces]; saveData(true);
      }
    },
    unpinNode: (targetNode: any) => unpin(getNodePath(targetNode)),
    checkIsPinned: (targetNode: any) => workspaces[currentIndex]?.pinned?.some((p:any) => p.path === getNodePath(targetNode)),
    getClickBehavior: () => workspaces[currentIndex]?.open_in_new_tab || false,
    saveWorkspace: () => saveData(true),
    // 💥 新規追加: ツリーから編集モードを呼び出す
    editSmartFolder: (node: any) => {
      editingSmartNode = node;
      isSmartFolderModalOpen = true;
    },
    
    openNewFileModal: (dirPath: string, callback: () => void) => {
      newFileTargetDir = dirPath;
      newFileCallback = callback;
      isNewFileModalOpen = true;
    },

   // 💥 追加: 個別フォルダのソート設定用アクション
    getGlobalSort: () => ({
      by: workspaces[currentIndex]?.sort_by || 'name',
      order: workspaces[currentIndex]?.sort_order || 'asc'
    }),
    setNodeSort: (node: any, by: string, order: string) => {
      node.sort_by = by;
      node.sort_order = order;
      workspaces = [...workspaces];
      // 💥 変更: saveData(true) に変更
      saveData(true);
    },

    // 💥 追加: ライブラリ取得と追加の処理
    getLibraries: () => workspaces.filter(w => w.category === 'Library'),
    addNodeToLibrary: async (node: any, libId: string) => {
      let targetLib = workspaces.find(w => w.id === libId);
      
      // 新規作成の場合
      if (libId === 'new') {
        const newName = prompt("新しいライブラリの名前を入力してください");
        if (!newName) return;
        targetLib = { 
          id: Date.now().toString(), name: newName, category: 'Library', 
          nodes: [], links: [], pinned: [], linked_libraries: [], is_flat: false,
          editor_font: workspaces[currentIndex]?.editor_font || 'sans-serif'
        };
        workspaces.push(targetLib);
      }
      if (!targetLib) return;
      
      // テスト済みの関数で完全に独立したデータを作ってから放り込む
      const clonedNode = cloneNodeAsIndependent(node);
      targetLib.nodes.push(clonedNode);
      workspaces = [...workspaces];
      await saveData(true);
      alert(`ライブラリ「${targetLib.name}」に登録しました`);
    }

  });

  function unpin(path: string) {
    workspaces[currentIndex].pinned = workspaces[currentIndex].pinned.filter((p:any) => p.path !== path);
    workspaces = [...workspaces]; saveData(true);
  }

    // 💥 追加: ピン留めされた簡単な情報から、ツリー上の「本物」のデータを探し出す関数
  function getPinnedNode(pin: any) {
    const ws = workspaces[currentIndex];
    if (!ws) return pin;

    // ツリーを再帰的に探す関数
    function findNode(nodes: any[]): any {
      for (const n of nodes) {
        const path = n.type === 'Folder' ? n.original_path : n.path;
        if (n.type === pin.item_type && n.name === pin.name && path === pin.path) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    }

    // まず現在のワークスペースから探す
    let realNode = findNode(ws.nodes);
    if (realNode) return realNode;

    // 見つからなければリンクされたライブラリの中も探す
    if (ws.linked_libraries) {
      for (const libId of ws.linked_libraries) {
        const lib = workspaces.find(w => w.id === libId);
        if (lib) {
          realNode = findNode(lib.nodes);
          if (realNode) return realNode;
        }
      }
    }
    // どこにもなければ、とりあえず空のダミーを作って返す
    return { type: pin.item_type, name: pin.name, path: pin.path, original_path: pin.path, children: [] };
  }

  // --- フォルダ更新関連 ---
  async function refreshTree(nodes: any[], wsIndex: number): Promise<any[]> {
    const updatedNodes = [];
    for (let node of nodes) {
      if (node.type === 'Folder' && node.original_path) {
        if (node.smart_rules) {
          // 💥 変更: workspaceIndex を消し、workspaceNodes を渡す
          invoke('evaluate_smart_folder', { 
            rules: node.smart_rules, 
            workspaceNodes: workspaces[wsIndex].nodes 
          }).then(children => {
            node.children = children as any[];
            workspaces = [...workspaces]; 
          }).catch(() => {});
        } else {
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
            // 💥 変更: wsIndex を引き継ぐ
            node.children = await refreshTree(freshChildren, wsIndex);
          } catch (e) {}
        }
      }
      updatedNodes.push(node);
    }
    return updatedNodes;
  }


    async function handleRefresh() {
    if (!workspaces[currentIndex]) return;
    // 💥 変更: currentIndex を渡す
    workspaces[currentIndex].nodes = await refreshTree(workspaces[currentIndex].nodes, currentIndex);
    const linkedLibs = workspaces[currentIndex].linked_libraries;
    if (linkedLibs && linkedLibs.length > 0) {
      for (const libId of linkedLibs) {
        const libIndex = workspaces.findIndex(w => w.id === libId);
        if (libIndex !== -1) {
          // 💥 変更: libIndex を渡す
          workspaces[libIndex].nodes = await refreshTree(workspaces[libIndex].nodes, libIndex);
        }
      }
    }
    workspaces = [...workspaces]; 
    await saveData();
  }
  onMount(async () => {
    try {
      const savedTags = localStorage.getItem('registeredTags');
      if (savedTags) registeredTags.set(JSON.parse(savedTags));
      
      // 💥 追加: ローカルストレージから画像フォルダパスを復元する
      const savedImageFolder = localStorage.getItem('imageFolderPath');
      if (savedImageFolder) imageFolderPath.set(savedImageFolder);
    } catch (e) {}

    initTheme();

    try {
      workspaces = await invoke('load_workspaces');
      if (workspaces.length === 0) {
        workspaces = [{ 
          id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [], links: [], 
          pinned: [], linked_libraries: [], is_flat: false, open_in_new_tab: false, 
          saved_tabs: [], active_tab_id: null,
          editor_font: 'sans-serif' // 💥 追加
        }];
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

     // 💥 変更: i (インデックス) を渡す
      (async () => {
        for (let i = 0; i < workspaces.length; i++) {
          workspaces[i].nodes = await refreshTree(workspaces[i].nodes, i);
        }
        workspaces = [...workspaces];
      })();

    } catch (e) {}
  }); // ← 💥 これらを追加して onMount をきちんと閉じる！

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
  async function saveData(forceOverwrite = false) {
    try {
      // 💥 追加: 強制上書きの指示があれば、そのまま全保存する
      if (forceOverwrite) {
        await invoke('save_workspaces', { workspaces });
        return;
      }

      const latestWorkspaces: any[] = await invoke('load_workspaces');
      
      // 💥 追加: もしリストの数自体が変わっていた場合（削除や追加された場合）は強制上書きに切り替える
      if (latestWorkspaces.length !== workspaces.length) {
        await invoke('save_workspaces', { workspaces });
        return;
      }

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

    // 設定とテーマ
  let isSettingsOpen = false; 
  let tempFont = '';
  let activeSettingsTab = 'general';
  
  let tempTheme: Theme = { 
    id: 'temp', name: 'temp', bgColor: '#1f2937', textColor: '#e5e7eb', 
    scrollBg: '#111827', scrollThumb: '#4b5563', accentColor: '#3b82f6', 
    activeHighlightBg: '#1e3a8a', menuBg: '#111827' , selectionBg: '#4b5563'
  };


  // 💥 移動したCSS変数の適用処理を呼び出す
  $: if (typeof document !== 'undefined' && $activeTheme) {
    applyThemeToRoot($activeTheme);
  }

</script>

<!-- 💥 変更: on:click の中から `isAddFolderMenuOpen = false; isGlobalSortMenuOpen = false;` を削除しました（子部品の中で処理するため） -->
<svelte:window on:mousemove={doResize} on:mouseup={stopResize} on:click={() => { isListMenuOpen = false; }} />

<main class="h-screen w-screen flex select-none transition-colors duration-200"
      style="background-color: var(--bg-color); color: var(--text-color);">
  
  <div class="flex flex-col border-r border-black/10" style="width: {sidebarWidth}px; background-color: var(--bg-color);">

    <!-- 💥 変更: ここにあった長大なトップバーのHTMLの塊（約40行）をごっそり削って、以下のコンポーネント呼び出しだけにしてください -->
    <SidebarHeader
      bind:workspaces
      currentIndex={currentIndex}
      on:refresh={handleRefresh}
      on:save={() => saveData(true)}
      on:addNode={(e) => {
        workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, e.detail];
        saveData();
      }}
      on:openSmartFolder={() => {
        editingSmartNode = null;
        isSmartFolderModalOpen = true;
      }}
    />
    
    <div class="flex-1 p-2 overflow-auto">
      {#if workspaces[currentIndex]?.pinned && workspaces[currentIndex].pinned.length > 0}
        <div class="mb-2">
          <div class="flex items-center text-xs font-bold text-gray-500 mb-1 pl-1"><Pin size={12} class="mr-1" /> ピン留め</div>
          {#each workspaces[currentIndex].pinned as pin}
            <div class="flex items-center justify-between group">
             <div class="flex-1 overflow-hidden">
                <TreeNode node={getPinnedNode(pin)} isReadonly={false} />
              </div>
              
              <button on:click={() => unpin(pin.path)} class="flex items-center justify-center text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"><X size={12} /></button>
            </div>
          {/each}
        </div>
        <hr class="border-gray-700 border-dashed mb-2">
      {/if}

     <div>
        {#if workspaces.length > 0 && workspaces[currentIndex]}
          {#each getSortedNodes(workspaces[currentIndex].nodes, workspaces[currentIndex].sort_by, workspaces[currentIndex].sort_order) as node}
             <TreeNode {node} ownerId={workspaces[currentIndex].id} isLibraryNode={false} />
          {/each}
        {/if}
      </div>

      <!-- 💥 参照されているライブラリを一括表示 -->
      {#if workspaces[currentIndex]?.linked_libraries?.length > 0}
        {#each workspaces[currentIndex].linked_libraries as libId}
          {@const lib = workspaces.find(w => w.id === libId)}
          {#if lib}
            {#if lib.is_flat}
              {#each getSortedNodes(lib.nodes, lib.sort_by, lib.sort_order) as node}
                <TreeNode node={node} ownerId={lib.id} isLibraryNode={true} />
              {/each}
            {:else}
              <!-- 💥 変更: ライブラリのガワ(is_virtual_wrapper)として保護する -->
              <TreeNode node={{ type: 'Folder', name: lib.name, original_path: null, children: lib.nodes, is_virtual_wrapper: true }} ownerId={lib.id} isLibraryNode={true} />
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
    <div class="p-2 border-t border-black/10 flex items-center gap-1 relative" style="background-color: var(--menu-bg);">
      <!-- 💥 select にも背景色スタイルを指定 -->
      <select class="w-32 text-xs rounded py-1 px-1 outline-none border border-black/20" style="background-color: var(--bg-color); color: var(--text-color);" value={currentIndex} on:change={changeWorkspace}>
        {#each workspaces.map((w, i) => ({...w, originalIndex: i})).filter(w => w.category === 'Active') as ws}
          <option value={ws.originalIndex}>{ws.name}</option>
        {/each}
      </select>
      
      <button on:click|stopPropagation={() => isListMenuOpen = !isListMenuOpen} class="flex items-center justify-center w-7 h-7 hover:opacity-70 rounded transition"><Menu size={16} /></button>

      {#if isListMenuOpen}
        <div class="absolute bottom-10 left-36 border border-black/20 rounded shadow-xl z-50 py-1 w-48 text-sm" style="background-color: var(--menu-bg); color: var(--text-color);">
          <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; isCreateModalOpen = true; }}><SquarePen size={14} class="mr-2" /> リスト作成</button>
          <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; editingListIndex = currentIndex; isManageModalOpen = true; }}><Settings size={14} class="mr-2" /> リスト管理</button>
          <hr class="border-black/10 my-1">
          <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; isImportLibraryModalOpen = true; }}><Library size={14} class="mr-2" /> ライブラリを追加</button>
        </div>
      {/if}
      <div class="flex-1"></div>
      <button 
        on:click|stopPropagation={openSettings} 
        class="flex items-center justify-center w-7 h-7 opacity-70 hover:opacity-100 transition relative z-10"
      >
        <Settings size={16} />
      </button>
    </div>
  </div>

  <div class="w-1 bg-black/20 hover:bg-[var(--accent-color)] cursor-col-resize z-10 transition-colors" on:mousedown={startResize}></div>
  <div class="flex-1 overflow-hidden relative">
    {#if isResizing}<div class="absolute inset-0 z-50 cursor-col-resize"></div>{/if}
    <Editor />
  </div>
</main>

<!-- 💥 各種モーダル -->

<WorkspaceManager
  bind:workspaces
  bind:currentIndex
  bind:editingListIndex
  bind:isCreateModalOpen
  bind:isManageModalOpen
  bind:isImportLibraryModalOpen
  on:save={(e) => saveData(e.detail?.force || false)}
/>

{#if isSettingsOpen}
  <SettingsModal 
    bind:workspaces={workspaces}
    currentIndex={currentIndex}
    on:save={async () => { await saveData(true); isSettingsOpen = false; }}
    on:close={() => isSettingsOpen = false}
  />
{/if}
<!-- 💥 新規ファイル作成モーダル -->
<NewFileModal 
  bind:isOpen={isNewFileModalOpen} 
  targetDir={newFileTargetDir} 
  on:success={() => {
    if (newFileCallback) newFileCallback();
  }} 
/>

<!-- 💥 条件で抽出（スマートフォルダ）モーダル -->
<!-- 子から抽出完了(save)の知らせが来たら、親が責任を持ってツリーに組み込んで保存します -->
<SmartFolderModal
  bind:isOpen={isSmartFolderModalOpen}
  editingSmartNode={editingSmartNode}
  workspaceNodes={workspaces[currentIndex]?.nodes || []}
  on:save={(e) => {
    const { name, rules, children } = e.detail;
    if (editingSmartNode) {
      editingSmartNode.name = name;
      editingSmartNode.smart_rules = rules;
      editingSmartNode.children = children;
    } else {
      const newNode = { type: "Folder", name, original_path: rules.target_dir || "__workspace__", children, smart_rules: rules };
      workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, newNode];
    }
    workspaces = [...workspaces];
    saveData();
  }}
/>