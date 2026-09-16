<!-- アプリのメイン画面（ガワ）。全体のデータとモーダル状態を管理。 -->

<script lang="ts">
  import { setContext, onMount, onDestroy, tick } from 'svelte';
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
  import { listen } from '@tauri-apps/api/event';
  import LauncherWindow from '../features/launcher/LauncherWindow.svelte';
  import { refreshTree } from '../lib/workspace/treeUtils';
  import { isSpecialPath, isDashboardPath, getWorkspaceIdFromDashboardPath } from '../lib/utils/pathUtils';
   import { requestSaveWorkspaces, removeNodeFromWorkspace, pinNodeToWorkspace, unpinNodeFromWorkspace,   isNodePinned, getWorkspaceClickBehavior, getWorkspaceGlobalSort,  setWorkspaceNodeSort, getNodePath } from '../lib/workspace/workspaceManager';

  let isLauncherWindow = false;

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let isInitialized = false; 

 $: if (isInitialized && $workspacesStore[$currentWorkspaceIndex]) {
   getCurrentWindow().setTitle($workspacesStore[$currentWorkspaceIndex].name).catch(() => {});
   $editorFont = $workspacesStore[$currentWorkspaceIndex].editor_font || 'sans-serif';
 }

  // --- メニューとモーダルの状態 ---
  let isCreateModalOpen = false, isManageModalOpen = false;
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

  setContext('workspaceActions', {

    removeNode: removeNodeFromWorkspace,
    pinNode: pinNodeToWorkspace,
    unpinNode: (targetNode: any) => unpinNodeFromWorkspace(getNodePath(targetNode)),
    checkIsPinned: isNodePinned,
    getClickBehavior: getWorkspaceClickBehavior,
    saveWorkspace: () => requestSaveWorkspaces(true),

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

   // 個別フォルダのソート設定用アクション
    getGlobalSort: getWorkspaceGlobalSort,
    setNodeSort: setWorkspaceNodeSort
  });

    async function handleRefresh() {
     const currentWs = $workspacesStore[$currentWorkspaceIndex];
   if (!currentWs) return;
   
   // 最新のツリー情報を取得
   const refreshedMainNodes = await refreshTree(currentWs.nodes, currentWs.nodes);
   const linkedLibs = currentWs.linked_libraries || [];
   const libUpdates = [];
   
    if (linkedLibs && linkedLibs.length > 0) {
      for (const libId of linkedLibs) {
        const libIndex = $workspacesStore.findIndex(w => w.id === libId);
        if (libIndex !== -1) {
           const refreshedLibNodes = await refreshTree($workspacesStore[libIndex].nodes, $workspacesStore[libIndex].nodes);
          libUpdates.push({ index: libIndex, nodes: refreshedLibNodes });
        }
      }
    }
    
   // 取得したデータをStoreに一括反映
   workspacesStore.update(wsList => {
     if (wsList[$currentWorkspaceIndex]) {
       wsList[$currentWorkspaceIndex].nodes = refreshedMainNodes;
     }
     for (const update of libUpdates) {
       wsList[update.index].nodes = update.nodes;
     }
     return wsList;
   });

    await requestSaveWorkspaces();
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
       let loadedWorkspaces = await invoke('load_workspaces');
     if (loadedWorkspaces.length === 0) {
       loadedWorkspaces = [{ 
          id: Date.now().toString(), name: '作業中', category: 'Active', nodes: [], links: [], 
          pinned: [], linked_libraries: [], is_flat: false, open_in_new_tab: false, 
          saved_tabs: [], active_tab_id: null,
          editor_font: 'sans-serif' 
        }];
      } 

       let startWsIndex = 0;
      // 【一番最初】に開くべきワークスペースを決定する（チラつき防止）
      const params = new URLSearchParams(window.location.search);
      const wsParam = params.get('ws');
      if (wsParam !== null) {
        startWsIndex = parseInt(wsParam, 10);
      } else {
        const firstActive = loadedWorkspaces.findIndex((w: any) => w.category === 'Active');
       if(firstActive !== -1) startWsIndex = firstActive;
      }

      // Storeに初期データをセット
     workspacesStore.set(loadedWorkspaces);
     currentWorkspaceIndex.set(startWsIndex);

// ツリーの最新化を待たずに、保存されていた状態ですぐにタブを復元する
      const ws = loadedWorkspaces[startWsIndex];
      if (ws && ws.saved_tabs && ws.saved_tabs.length > 0) {
        const restored = [];
        for (const tab of ws.saved_tabs) {
          let content = "";
          let isDashboard = false;
          let workspaceId = "";
          
          if (tab.path) {
            // 💥 追加: ダッシュボードタブの復元処理分岐
            if (isDashboardPath(tab.path)) {
               isDashboard = true;
               // "__DASHBOARD__12345" から "12345" (workspaceId) を抽出
               workspaceId = getWorkspaceIdFromDashboardPath(tab.path) || '';
               try {
                 // ダッシュボード専用の読み込みコマンドを呼ぶ
                 content = await invoke('load_dashboard', { workspaceId });
               } catch (e) {
                 console.error("Failed to restore dashboard content", e);
               }
            } 
            // 既存の通常ファイル復元処理
            else if (!isSpecialPath(tab.path)) {
              try {
                content = await invoke('read_file_content', { path: tab.path });
              } catch(e) {}
            }
          }
          
          restored.push({ 
            id: tab.id, path: tab.path, title: tab.title, content, 
            isEditing: tab.isEditing, isDirty: false, lastModified: 0,
            // 💥 追加: 復元時にもダッシュボードフラグとIDを持たせる
            isDashboard,
            workspaceId
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
        // 背景でツリーをリフレッシュし、完了後にStoreを更新
       const updatedList = [...loadedWorkspaces];
       for (let i = 0; i < updatedList.length; i++) {
         updatedList[i].nodes = await refreshTree(updatedList[i].nodes, updatedList[i].nodes);
      }
    workspacesStore.set(updatedList);
    })();
    } catch (e) {}
  });




  async function deleteLink(id: string) {
       workspacesStore.update(wsList => {
     if (wsList[$currentWorkspaceIndex]) {
       wsList[$currentWorkspaceIndex].links = (wsList[$currentWorkspaceIndex].links || []).filter((l: any) => l.id !== id);
     }
     return wsList;
   });
    await requestSaveWorkspaces();
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
  
  <div class="flex flex-col border-r" 
        style="width: {sidebarWidth}px; background-color: var(--bg-color); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);">

    <SidebarHeader
      on:refresh={handleRefresh}
      on:addNode={(e) => {
         workspacesStore.update(ws => {
         if (ws[$currentWorkspaceIndex]) {
           ws[$currentWorkspaceIndex].nodes = [...(ws[$currentWorkspaceIndex].nodes || []), e.detail];
         }
         return ws;
       });
        requestSaveWorkspaces(true);
      }}
      on:openSmartFolder={() => {
        editingSmartNode = null;
        isSmartFolderModalOpen = true;
      }}
    />
    
    <SidebarTree />

    <!-- リンク固定エリア -->
     {#if $workspacesStore[$currentWorkspaceIndex]}
      <SidebarLinks 
        links={$workspacesStore[$currentWorkspaceIndex].links || []} 
        onLinkDelete={deleteLink} 
      />
    {/if}

    <!-- UI下部 -->
   <SidebarFooter 
      workspaces={$workspacesStore}
      currentIndex={$currentWorkspaceIndex}
      bind:editingListIndex
      bind:isCreateModalOpen
      bind:isManageModalOpen
      {openSettings}
    />
  </div>

   <!-- リサイズバー（Obsidian風: 広い当たり判定 + ホバー時に太くなるアニメーション） -->
   <div class="relative w-2 -mx-1 flex items-center justify-center cursor-col-resize z-10 group" 
        on:mousedown={startResize}>
     <div class="h-full w-[1px] bg-[color-mix(in_srgb,var(--text-color)_5%,transparent)] transition-all duration-20 group-hover:w-[3px] group-hover:bg-[var(--accent-color)]"></div>
   </div>
  <div class="flex-1 overflow-hidden relative">
    {#if isResizing}<div class="absolute inset-0 z-50 cursor-col-resize"></div>{/if}
    <Editor />
  </div>
</main>

<!-- 💥 各種モーダル -->

<WorkspaceManager
  bind:editingListIndex
  bind:isCreateModalOpen
  bind:isManageModalOpen
  on:save={(e) => requestSaveWorkspaces(e.detail?.force || false)}
/>

{#if isSettingsOpen}
  <SettingsModal 
    on:save={async () => { await requestSaveWorkspaces(true); isSettingsOpen = false; }}
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
  workspaceNodes={$workspacesStore[$currentWorkspaceIndex]?.nodes || []}
  on:save={(e) => {
    const { name, rules, children } = e.detail;
    workspacesStore.update(wsList => {
    if (editingSmartNode) {
      editingSmartNode.name = name;
      editingSmartNode.smart_rules = rules;
      editingSmartNode.children = children;
    } else {
      const newNode = { type: "Folder", name, original_path: rules.target_dir || "__workspace__", children, smart_rules: rules };
      wsList[$currentWorkspaceIndex].nodes = [...wsList[$currentWorkspaceIndex].nodes, newNode];
    }
     return wsList;
   });
    requestSaveWorkspaces();
  }}
/>

{/if}