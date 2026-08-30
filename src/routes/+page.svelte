<!-- アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。 -->

<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { getCurrentWindow } from '@tauri-apps/api/window'; 
  import Editor from '../components/Editor/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import SettingsModal from '../components/Settings/SettingsModal.svelte';
  import NewFileModal from '../components/Modals/NewFileModal.svelte';
  import SmartFolderModal from '../components/Modals/SmartFolderModal.svelte';
  import WorkspaceManager from '../components/Modals/WorkspaceManager.svelte';
  import SidebarHeader from '../components/Sidebar/SidebarHeader.svelte';
  import SidebarTree from '../components/Sidebar/SidebarTree.svelte';
  import SidebarFooter from '../components/Sidebar/SidebarFooter.svelte';
  import SidebarLinks from '../components/Sidebar/SidebarLinks.svelte';
  import { activeTheme, initTheme, applyThemeToRoot } from '../lib/settings/theme';
  import { initStyles } from '../features/styleSettings/styleStore'; 
  import { editorFont, openTabs, activeTabId, currentWorkspaceIndex, openSearchTab, registeredTags, showLauncherOnStartup, workspacesStore } from '../lib/stores';
  import { cloneNodeAsIndependent } from '../lib/library';
  import { listen } from '@tauri-apps/api/event';
  import LauncherWindow from '../features/launcher/LauncherWindow.svelte';
  import { refreshTree } from '../lib/workspace/treeUtils';


  let isLauncherWindow = false;

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let workspaces: any[] = [];
  let currentIndex = 0;
  $: $workspacesStore = workspaces;
  $: $currentWorkspaceIndex = currentIndex;

  let isInitialized = false; 

  $: if (isInitialized && workspaces[currentIndex]) {
    getCurrentWindow().setTitle(workspaces[currentIndex].name).catch(() => {});
    
    // 💥 追加: ワークスペースを切り替えたら、そのワークスペースのフォント設定を読み込む
    $editorFont = workspaces[currentIndex].editor_font || 'sans-serif';
  }

  // --- メニューとモーダルの状態 ---
  let isCreateModalOpen = false, isManageModalOpen = false, isImportLibraryModalOpen = false;
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

    async function handleRefresh() {
    if (!workspaces[currentIndex]) return;
workspaces[currentIndex].nodes = await refreshTree(workspaces[currentIndex].nodes, workspaces[currentIndex].nodes);
    const linkedLibs = workspaces[currentIndex].linked_libraries;
    if (linkedLibs && linkedLibs.length > 0) {
      for (const libId of linkedLibs) {
        const libIndex = workspaces.findIndex(w => w.id === libId);
        if (libIndex !== -1) {
           workspaces[libIndex].nodes = await refreshTree(workspaces[libIndex].nodes, workspaces[libIndex].nodes);
        }
      }
    }
    workspaces = [...workspaces]; 
    await saveData();
  }
  onMount(async () => {

    // このウィンドウがランチャー用として開かれたかどうかの判定
    if (window.location.search.includes('launcher=true')) {
        isLauncherWindow = true;
        return; // これ以降のメイン画面用の初期化処理をすべてキャンセル
    }

    try {
      const savedTags = localStorage.getItem('registeredTags');
      if (savedTags) registeredTags.set(JSON.parse(savedTags));
      
      // ローカルストレージから画像フォルダパスを復元する
      const savedImageFolder = localStorage.getItem('imageFolderPath');
      if (savedImageFolder) imageFolderPath.set(savedImageFolder);
    } catch (e) {}

    // ランチャー設定と状態の読み込み
    const launcherSetting = localStorage.getItem('showLauncherOnStartup') === 'true';
    showLauncherOnStartup.set(launcherSetting);
    
    // URLに ?ws= があるか（＝ランチャーから選択されてリロードされた後かどうか）
    const hasWsParam = window.location.search.includes('ws=');

    if (launcherSetting && !hasWsParam) {
        // 設定ONで、かつまだ選ばれていない初回起動時はランチャーを開く
        await invoke('open_launcher');
        
        // ランチャーからの選択を待ち、選ばれたらリロードする
        await listen('workspace-selected', (event: any) => {
            window.location.href = `/?ws=${event.payload.index}`;
        });
        
        // メイン画面は隠したまま、ここで処理を終了（裏で無駄なファイル読み込みをさせないため）
        return;
    }

    initTheme();
    initStyles(); 

    try {
      workspaces = await invoke('load_workspaces');
      if (workspaces.length === 0) {
        workspaces = [{ 
          id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [], links: [], 
          pinned: [], linked_libraries: [], is_flat: false, open_in_new_tab: false, 
          saved_tabs: [], active_tab_id: null,
          editor_font: 'sans-serif' 
        }];
      } 
      
      // 【一番最初】に開くべきワークスペースを決定する（チラつき防止）
      const params = new URLSearchParams(window.location.search);
      const wsParam = params.get('ws');
      if (wsParam !== null) {
        currentIndex = parseInt(wsParam, 10);
      } else {
        const firstActive = workspaces.findIndex(w => w.category === 'Active');
        if(firstActive !== -1) currentIndex = firstActive;
      }

      // ツリーの最新化を待たずに、保存されていた状態ですぐにタブを復元する
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
          restored.push({ 
            id: tab.id, path: tab.path, title: tab.title, content, 
            isEditing: tab.isEditing, isDirty: false, lastModified: 0 
          });
        }
        openTabs.set(restored);
        activeTabId.set(ws.active_tab_id || restored[0].id);
      }
      
      // この時点で画面をユーザーに見せる
      isInitialized = true; 

      // 初期化が終わったこのタイミングでメイン画面をパッと表示する
      await invoke('show_main_window');

      (async () => {
        for (let i = 0; i < workspaces.length; i++) {
          workspaces[i].nodes = await refreshTree(workspaces[i].nodes, workspaces[i].nodes);
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
  async function saveData(forceOverwrite = false) {
    try {
      // 強制上書きの指示があれば、そのまま全保存する
      if (forceOverwrite) {
        await invoke('save_workspaces', { workspaces });
        return;
      }

      const latestWorkspaces: any[] = await invoke('load_workspaces');
      
      // もしリストの数自体が変わっていた場合（削除や追加された場合）は強制上書きに切り替える
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



  async function deleteLink(id: string) {
    workspaces[currentIndex].links = (workspaces[currentIndex].links || []).filter((l: any) => l.id !== id);
    workspaces = [...workspaces];
    await saveData();
  }

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


<svelte:window on:mousemove={doResize} on:mouseup={stopResize} />

{#if isLauncherWindow}
    <!-- ランチャーとして開かれた場合は、これだけを表示 -->
    <LauncherWindow />
{:else}
    <!-- メイン画面として開かれた場合は、既存のUIを表示 -->


<main class="h-screen w-screen flex select-none transition-colors duration-200"
      style="background-color: var(--bg-color); color: var(--text-color);">
  
  <div class="flex flex-col border-r border-black/10" style="width: {sidebarWidth}px; background-color: var(--bg-color);">

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
    
    <SidebarTree bind:workspaces {currentIndex} {unpin} />

    <!-- リンク固定エリア -->
    {#if workspaces[currentIndex]}
      <SidebarLinks 
        links={workspaces[currentIndex].links || []} 
        onLinkDelete={deleteLink} 
      />
    {/if}

    <!-- UI下部 -->
   <SidebarFooter 
      {workspaces}
      {currentIndex}
      bind:editingListIndex
      bind:isCreateModalOpen
      bind:isManageModalOpen
      bind:isImportLibraryModalOpen
      {openSettings}
    />
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

{/if}