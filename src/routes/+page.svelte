<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { getCurrentWindow } from '@tauri-apps/api/window'; 
  import Editor from '../components/Editor.svelte';
  import TreeNode from '../components/TreeNode.svelte';
  import { editorFont, openTabs, activeTabId, currentWorkspaceIndex, openSearchTab, registeredTags, activeTheme, customThemes, defaultThemes, type Theme } from '../lib/stores';
  import { cloneNodeAsIndependent } from '../lib/library';
  import { RotateCw, ArrowUpDown, Search, FolderPlus, FilePlus, Pin, X, Menu, SquarePen, Settings, Library, Archive, Link } from 'lucide-svelte';
 

  let sidebarWidth = 260;
  let isResizing = false;
  function startResize() { isResizing = true; }
  function stopResize() { isResizing = false; }
  function doResize(e: MouseEvent) { if (isResizing) sidebarWidth = Math.max(150, Math.min(e.clientX, 800)); }

  let workspaces: any[] = [];
  let currentIndex = 0;
  $: $currentWorkspaceIndex = currentIndex;
  let isInitialized = false; 

  let isGlobalSortMenuOpen = false;

  $: if (isInitialized && workspaces[currentIndex]) {
    getCurrentWindow().setTitle(workspaces[currentIndex].name).catch(() => {});
    
    // 💥 追加: ワークスペースを切り替えたら、そのワークスペースのフォント設定を読み込む
    $editorFont = workspaces[currentIndex].editor_font || 'sans-serif';
  }

  // --- メニューとモーダルの状態 ---
  let isListMenuOpen = false, isCreateModalOpen = false, isManageModalOpen = false, isImportLibraryModalOpen = false;
  // 💥 追加: フォルダ追加メニューとスマートフォルダ関連
  let isAddFolderMenuOpen = false, isSmartFolderModalOpen = false;
  let sfName = '', sfTarget = '', sfMatch = 'AND', sfKeep = true;
  let sfTargetWorkspace = false; // 💥 追加: チェックボックス用フラグ
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

  // 💥 追加: ワークスペース全体のソート設定を変更する関数
  function changeGlobalSort(type: 'by' | 'order', value: string) {
    if (workspaces[currentIndex]) {
      if (type === 'by') workspaces[currentIndex].sort_by = value;
      else workspaces[currentIndex].sort_order = value;
      saveData();
    }
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
      sfName = node.name;
      sfTarget = node.smart_rules.target_dir;
      sfTargetWorkspace = node.smart_rules.target_workspace || false; // 💥 追加
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
    if (!sfName || (!sfTarget && !sfTargetWorkspace)) return alert("名前と、少なくとも１つの抽出元を指定してください");
    
    const rules = { target_dir: sfTarget, target_workspace: sfTargetWorkspace, match_type: sfMatch, conditions: sfConds, keep_structure: sfKeep };
    try {
      // 💥 変更: 同様に workspaceNodes を渡す
      const children = await invoke('evaluate_smart_folder', { 
        rules, 
        workspaceNodes: workspaces[currentIndex].nodes 
      });
      
      if (editingSmartNode) {
        editingSmartNode.name = sfName;
        editingSmartNode.smart_rules = rules;
        editingSmartNode.children = children; 
      } else {
        // 💥 変更: original_path が空にならないように補完（更新判定のため）
        workspaces[currentIndex].nodes = [...workspaces[currentIndex].nodes, { type: "Folder", name: sfName, original_path: sfTarget || "__workspace__", children, smart_rules: rules }];
      }
      
      workspaces = [...workspaces];
      await saveData();
      isSmartFolderModalOpen = false;
    } catch (e) { alert("抽出に失敗しました: " + e); }
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
    // 💥 追加: ローカルストレージからタグ一覧を復元する
    try {
      const savedTags = localStorage.getItem('registeredTags');
      if (savedTags) registeredTags.set(JSON.parse(savedTags));
    } catch (e) {}
    // テーマの復元と壊れたデータの自動修復
    try {
      const savedTheme = localStorage.getItem('activeTheme');
      if (savedTheme) {
        let t = JSON.parse(savedTheme);
        t.menuBg = t.menuBg || '#1a253c'; // 古いデータへの補完
        activeTheme.set(t);
      }
      
      const savedCustoms = localStorage.getItem('customThemes');
      if (savedCustoms) {
        let parsed = JSON.parse(savedCustoms);
        if (parsed.length >= 3) {
          parsed[0].id = 'custom1'; parsed[0].name = 'カスタム１';
          parsed[1].id = 'custom2'; parsed[1].name = 'カスタム２';
          parsed[2].id = 'custom3'; parsed[2].name = 'カスタム３';
        }
        parsed = parsed.map((t: any) => ({...t, menuBg: t.menuBg || '#1a253c'})); // 古いデータへの補完
        customThemes.set(parsed);
      }
    } catch (e) {}
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
  async function createNewWorkspace() {
    if (!newListName) return;
    
    workspaces.push({ 
      id: Date.now().toString(), 
      name: newListName, 
      category: 'Active', 
      nodes: [], 
      links: [], 
      pinned: [], 
      linked_libraries: [], 
      is_flat: false,
      editor_font: 'sans-serif' // 💥 追加
    });
    
    currentIndex = workspaces.length - 1;
    workspaces = [...workspaces]; 
    await saveData(true);
    
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
      workspaces = [...workspaces]; await saveData(true);
    }
    isImportLibraryModalOpen = false;
  }


  async function deleteEditingList() {
    // 💥 Tauriのネイティブダイアログを呼び出す
    const isYes = await tauriConfirm("本当に削除しますか？", { title: "確認", kind: "warning" });
    if (isYes) {
      workspaces.splice(editingListIndex, 1);
      if (currentIndex >= workspaces.length) currentIndex = Math.max(0, workspaces.length - 1);
      workspaces = [...workspaces]; await saveData(true);
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

  // 設定とテーマ
  let isSettingsOpen = false; 
  let tempFont = '';
  
  let activeSettingsTab = 'general';
  let selectedPreset = 'dark';
  let selectedCustomSlot = 'custom1';

  let tempTheme: Theme = { 
    id: 'temp', name: 'temp', bgColor: '#26282c', textColor: '#e5e7eb', 
    scrollBg: '#1a253c', scrollThumb: '#4b5563', accentColor: '#3b82f6', 
    activeHighlightBg: '#1e3a8a', menuBg: '#1a253c' 
  };

  function openSettings() { 
    tempFont = $editorFont; 
    tempTheme = { 
      id: $activeTheme.id || 'custom',
      name: $activeTheme.name || 'Custom',
      bgColor: $activeTheme.bgColor || '#26282c',
      textColor: $activeTheme.textColor || '#e5e7eb',
      scrollBg: $activeTheme.scrollBg || '#1a253c',
      scrollThumb: $activeTheme.scrollThumb || '#4b5563',
      accentColor: $activeTheme.accentColor || '#3b82f6',
      activeHighlightBg: $activeTheme.activeHighlightBg || '#1e3a8a',
      menuBg: $activeTheme.menuBg || '#1a253c'
    };
    
    activeSettingsTab = 'general';
    isSettingsOpen = true; 
  }
  
  function applyPreset() {
    const t = defaultThemes.find(x => x.id === selectedPreset) || $customThemes.find(x => x.id === selectedPreset);
    if (t) tempTheme = { ...t };
  }

  function saveCustomTheme() {
    const index = $customThemes.findIndex(x => x.id === selectedCustomSlot);
    if (index !== -1) {
      $customThemes[index] = { ...tempTheme, id: selectedCustomSlot, name: $customThemes[index].name };
      customThemes.set($customThemes);
      localStorage.setItem('customThemes', JSON.stringify($customThemes));
      alert('カスタムテーマを保存しました');
    }
  }

  function saveSettings() { 
    $editorFont = tempFont; 
    $activeTheme = { ...tempTheme };
    if (workspaces[currentIndex]) {
      workspaces[currentIndex].editor_font = tempFont;
      saveData();
    }
    localStorage.setItem('activeTheme', JSON.stringify($activeTheme));
    isSettingsOpen = false; 
  }

    // 💥 追加: スクロールバーなどアプリ全体に確実にテーマを適用するため、htmlのルートに直接CSS変数をセットする
  $: if (typeof document !== 'undefined' && $activeTheme) {
    const root = document.documentElement;
    root.style.setProperty('--bg-color', $activeTheme.bgColor);
    root.style.setProperty('--text-color', $activeTheme.textColor);
    root.style.setProperty('--scroll-bg', $activeTheme.scrollBg);
    root.style.setProperty('--scroll-thumb', $activeTheme.scrollThumb);
    root.style.setProperty('--accent-color', $activeTheme.accentColor);
    root.style.setProperty('--active-highlight-bg', $activeTheme.activeHighlightBg);
    root.style.setProperty('--menu-bg', $activeTheme.menuBg); // 💥 追加
  }

</script>

<svelte:window on:mousemove={doResize} on:mouseup={stopResize} on:click={() => { isListMenuOpen = false; isAddFolderMenuOpen = false; isGlobalSortMenuOpen = false; }} />
<main class="h-screen w-screen flex select-none transition-colors duration-200"
      style="background-color: var(--bg-color); color: var(--text-color);">
  
  <div class="flex flex-col border-r border-black/10" style="width: {sidebarWidth}px; background-color: var(--bg-color);">

    <!-- 💥 左上のトップバー -->
    <div class="p-3 border-b border-black/10 font-bold flex justify-between items-center">
      <span class="truncate pr-2">{workspaces[currentIndex]?.name || 'リスト'}</span>
      <div class="flex gap-2 shrink-0 relative">
       <button on:click={handleRefresh} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="更新"><RotateCw size={14} /></button>

        <div class="relative flex items-center">
          <button on:click|stopPropagation={() => isGlobalSortMenuOpen = !isGlobalSortMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="並び替え"><ArrowUpDown size={14} /></button>
          {#if isGlobalSortMenuOpen}
            <div class="absolute top-8 left-0 border border-black/20 rounded shadow-xl z-50 py-1 w-32 text-sm font-normal" style="background-color: var(--bg-color); color: var(--text-color);">
              <button class="block w-full text-left px-4 py-1.5 hover:bg-black/10 transition" on:click={() => changeGlobalSort('order', 'asc')}>
                <span class="inline-block w-4">{workspaces[currentIndex]?.sort_order !== 'desc' ? '✓' : ''}</span>昇順
              </button>
              <button class="block w-full text-left px-4 py-1.5 hover:bg-black/10 transition" on:click={() => changeGlobalSort('order', 'desc')}>
                <span class="inline-block w-4">{workspaces[currentIndex]?.sort_order === 'desc' ? '✓' : ''}</span>降順
              </button>
              <hr class="border-black/10 my-1">
              <button class="block w-full text-left px-4 py-1.5 hover:bg-black/10 transition" on:click={() => changeGlobalSort('by', 'name')}>
                <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'name' || !workspaces[currentIndex]?.sort_by ? '✓' : ''}</span>名前
              </button>
              <button class="block w-full text-left px-4 py-1.5 hover:bg-black/10 transition" on:click={() => changeGlobalSort('by', 'created')}>
                <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'created' ? '✓' : ''}</span>作成日
              </button>
              <button class="block w-full text-left px-4 py-1.5 hover:bg-black/10 transition" on:click={() => changeGlobalSort('by', 'modified')}>
                <span class="inline-block w-4">{workspaces[currentIndex]?.sort_by === 'modified' ? '✓' : ''}</span>更新日
              </button>
            </div>
          {/if}
        </div>
        
        <button on:click={openSearchTab} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition" title="検索"><Search size={14} /></button>
        
        <button on:click|stopPropagation={() => isAddFolderMenuOpen = !isAddFolderMenuOpen} class="flex items-center justify-center w-6 h-6 hover:opacity-70 rounded transition"><FolderPlus size={14} /></button>
        {#if isAddFolderMenuOpen}
          <div class="absolute top-8 right-0 border border-black/20 rounded shadow-xl z-50 py-1 w-40 text-sm font-normal" style="background-color: var(--bg-color); color: var(--text-color);">
            <button class="block w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isAddFolderMenuOpen = false; addFolder(); }}>普通のフォルダ</button>
            <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isAddFolderMenuOpen = false; addFile(); }}><FilePlus size={14} class="mr-2" /> ファイルを追加</button>
            <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isAddFolderMenuOpen = false; sfName=''; sfTarget=''; sfConds=[]; editingSmartNode=null; isSmartFolderModalOpen = true; }}><Search size={14} class="mr-2" /> 条件で抽出</button>
          </div>
        {/if}
      </div>
    </div>
    
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

<!-- 1. リスト作成 -->
{#if isCreateModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">ワークスペースを作成</h2>
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none mb-6" bind:value={newListName} placeholder="新しい名前" on:keydown={(e) => e.key === 'Enter' && createNewWorkspace()} />
      
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isCreateModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={createNewWorkspace}>作成</button>
      </div>
    </div>
  </div>
{/if}

<!-- 2. リスト管理 -->
{#if isManageModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-[500px]" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">リスト管理</h2>
      <div class="flex gap-2 mb-4">
        <select class="flex-1 bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={editingListIndex}>
          <optgroup label="ワークスペース">{#each workspaces.map((w, i) => ({...w, i})).filter(w => w.category === 'Active') as ws}<option value={ws.i}>{ws.name}</option>{/each}</optgroup>
          <optgroup label="ライブラリ">{#each workspaces.map((w, i) => ({...w, i})).filter(w => w.category === 'Library') as ws}<option value={ws.i}>{ws.name}</option>{/each}</optgroup>
        </select>
        <button on:click={deleteEditingList} class="px-3 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-100 rounded text-sm transition font-bold">削除</button>
      </div>

      {#if workspaces[editingListIndex]}
        <div class="bg-black/5 p-4 rounded border border-black/10 mb-6 max-h-[50vh] overflow-y-auto">
          <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none mb-4" bind:value={workspaces[editingListIndex].name} on:change={() => saveData(true)} />
          
          {#if workspaces[editingListIndex].category === 'Active'}
            <div class="mb-4 p-3 bg-black/5 rounded border border-black/10">
              <div class="text-xs opacity-70 mb-2">ファイルをクリックした時の動作</div>
              <label class="flex items-center text-sm cursor-pointer mb-2">
                <input type="radio" bind:group={workspaces[editingListIndex].open_in_new_tab} value={false} on:change={() => saveData(true)} class="mr-2 accent-[var(--accent-color)]">
                今開いているタブを上書きする
              </label>
              <label class="flex items-center text-sm cursor-pointer">
                <input type="radio" bind:group={workspaces[editingListIndex].open_in_new_tab} value={true} on:change={() => saveData(true)} class="mr-2 accent-[var(--accent-color)]">
                新しいタブで開く
              </label>
            </div>
          {/if}

          {#if workspaces[editingListIndex].category === 'Library'}
            <div class="mb-4 p-3 bg-black/5 rounded border border-black/10">
              <label class="flex items-center text-sm cursor-pointer">
                <input type="checkbox" bind:checked={workspaces[editingListIndex].is_flat} on:change={() => saveData(true)} class="mr-2 accent-[var(--accent-color)]">
                このライブラリをフォルダにまとめず、直接中身を展開して表示する
              </label>
            </div>
          {/if}

          {#if workspaces[editingListIndex].category === 'Active' && workspaces[editingListIndex].linked_libraries?.length > 0}
            <div class="mb-4 p-3 bg-black/5 rounded border border-black/10">
              <div class="text-xs opacity-70 mb-2">リンク中のライブラリ</div>
              {#each workspaces[editingListIndex].linked_libraries as libId}
                {@const lib = workspaces.find(w => w.id === libId)}
                {#if lib}
                  <div class="flex items-center justify-between text-sm mb-1">
                    <span>{lib.name}</span>
                    <button class="text-xs text-red-400 hover:text-red-300" on:click={() => { workspaces[editingListIndex].linked_libraries = workspaces[editingListIndex].linked_libraries.filter(id => id !== libId); workspaces = [...workspaces]; saveData(); }}>解除</button>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}

          <!-- リンク管理 -->
          <div class="p-3 bg-black/5 rounded border border-black/10">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs opacity-70">🔗 リンク</span>
              <button on:click={() => openLinkModal()} class="px-2 py-1 bg-black/20 hover:bg-black/30 rounded text-xs transition">＋ 追加</button>
            </div>
            <div class="space-y-2">
              {#each workspaces[editingListIndex].links || [] as link}
                <div class="flex items-center justify-between text-sm bg-black/10 p-2 rounded">
                  <span class="truncate flex-1 pr-2">{link.title}</span>
                  <div class="flex gap-3 shrink-0">
                    <button class="text-xs text-[var(--accent-color)] hover:brightness-110" on:click={() => openLinkModal(link)}>編集</button>
                    <button class="text-xs text-red-400 hover:text-red-300" on:click={() => deleteLink(link.id)}>削除</button>
                  </div>
                </div>
              {:else}
                <div class="text-xs opacity-50 text-center py-2">リンクはありません</div>
              {/each}
            </div>
          </div>

        </div>
      {/if}
      <div class="flex justify-end"><button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isManageModalOpen = false}>閉じる</button></div>
    </div>
  </div>
{/if}

<!-- 3. ライブラリ追加 -->
{#if isImportLibraryModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">ライブラリを追加</h2>
      <select class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm mb-4 outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedLibraryId}>
        <option value="" disabled selected>ライブラリを選択</option>
        {#each workspaces.filter(w => w.category === 'Library') as lib}<option value={lib.id}>{lib.name}</option>{/each}
      </select>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isImportLibraryModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={importLibrary}>追加</button>
      </div>
    </div>
  </div>
{/if}

<!-- リンク・設定モーダル -->
{#if linkContextMenu.show}
  <div class="fixed inset-0 z-40" on:click={closeLinkMenu} on:contextmenu|preventDefault={closeLinkMenu}></div>
  <div class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-32" style="left: {linkContextMenu.x}px; top: {linkContextMenu.y}px; background-color: var(--menu-bg); color: var(--text-color);">
    <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition" on:click={() => { openLinkModal(linkContextMenu.link); closeLinkMenu(); }}>編集</button>
    <button class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-black/10 transition" on:click={() => deleteLink(linkContextMenu.link.id)}>削除</button>
  </div>
{/if}

{#if isLinkModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">{editingLinkId ? 'リンクを編集' : 'リンクを追加'}</h2>
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm mb-4 outline-none" bind:value={linkTitle} placeholder="表示テキスト" />
      <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm mb-6 outline-none" bind:value={linkUrl} placeholder="URL" />
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isLinkModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={saveLink}>保存</button>
      </div>
    </div>
  </div>
{/if}
{#if isSettingsOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <!-- モーダル自体もテーマ色と連動 -->
    <div class="rounded shadow-xl border border-black/20 flex overflow-hidden w-[700px] h-[550px]" style="background-color: var(--menu-bg); color: var(--text-color);">
      
      <!-- 左サイドバー（タブ） -->
      <div class="w-1/4 bg-black/10 p-4 space-y-2 text-sm border-r border-black/10">
        <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'general' ? 'bg-[var(--accent-color)] text-white font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'general'}>一般</button>
        <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'theme' ? 'bg-[var(--accent-color)] text-white font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'theme'}>テーマ</button>
      </div>

      <!-- 右コンテンツ -->
      <div class="w-3/4 p-6 overflow-y-auto flex flex-col relative">
        
        {#if activeSettingsTab === 'general'}
          <h2 class="text-lg font-bold mb-6">一般設定</h2>
          
          <div class="mb-6">
            <div class="text-sm opacity-80 mb-2">フォント名</div>
            <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" bind:value={tempFont} placeholder="フォント名" />
          </div>

          <hr class="border-black/10 mb-6">

          <div class="mb-6">
            <div class="text-sm opacity-80 mb-2">タグの管理</div>
            <div class="flex gap-2 mb-4">
              <input type="text" class="flex-1 bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" bind:value={newTagInput} placeholder="新しいタグ名を入力" on:keydown={(e) => e.key === 'Enter' && addTag()} />
              <button class="px-4 py-2 bg-black/20 hover:bg-black/30 rounded text-sm transition" on:click={addTag}>登録</button>
            </div>
            <div class="flex gap-2">
              <!-- 💥 select に背景色を指定 -->
              <select class="flex-1 border border-black/20 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedTagToRemove}>
                <option value="" disabled selected>登録済みのタグ一覧</option>
                {#each $registeredTags as tag}<option value={tag}>{tag}</option>{/each}
              </select>
              <button class="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-100 rounded text-sm transition" on:click={removeTag}>削除</button>
            </div>
          </div>

        {:else if activeSettingsTab === 'theme'}
          <h2 class="text-lg font-bold mb-6">テーマ設定</h2>
          
          <div class="mb-6 bg-black/5 p-4 rounded border border-black/10">
            <div class="flex justify-between items-center">
              <span class="text-sm font-bold">テーマの適用</span>
              <div class="flex gap-2">
                <!-- 💥 select に背景色を指定 -->
                <select class="border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedPreset}>
                  <optgroup label="プリセット">{#each defaultThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}</optgroup>
                  <optgroup label="カスタム">{#each $customThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}</optgroup>
                </select>
                <button class="px-4 py-1.5 bg-[var(--accent-color)] text-white rounded text-sm font-bold shadow hover:brightness-110 transition" on:click={applyPreset}>適用</button>
              </div>
            </div>
          </div>

          <div class="space-y-4 mb-6 px-2">
            <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">エディタ・メニュー背景色</span>
              <input type="color" bind:value={tempTheme.bgColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
          <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">メニュー・ポップアップ背景色</span>
              <input type="color" bind:value={tempTheme.menuBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
            <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">文字色（全体・アイコン）</span>
              <input type="color" bind:value={tempTheme.textColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
            <!-- 💥 追加: ツリー選択時の背景色 -->
            <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">ツリー選択時の背景色</span>
              <input type="color" bind:value={tempTheme.activeHighlightBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
            <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">スクロールバーの背景色</span>
              <input type="color" bind:value={tempTheme.scrollBg} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
            <div class="flex justify-between items-center border-b border-black/5 pb-2">
              <span class="text-sm">スクロールバーの色</span>
              <input type="color" bind:value={tempTheme.scrollThumb} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
            <div class="flex justify-between items-center pb-2">
              <span class="text-sm">ハイライト色（タブ上部等）</span>
              <input type="color" bind:value={tempTheme.accentColor} class="w-14 h-8 bg-transparent cursor-pointer rounded" />
            </div>
          </div>

          <div class="mt-auto bg-black/5 p-4 rounded border border-black/10">
            <div class="flex justify-between items-center">
              <span class="text-sm font-bold">現在の状態をカスタムテーマに保存</span>
              <div class="flex gap-2">
                <!-- 💥 select に背景色を指定 -->
                <select class="border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedCustomSlot}>
                  {#each $customThemes as theme}<option value={theme.id}>{theme.name}</option>{/each}
                </select>
                <button class="px-4 py-1.5 bg-black/30 hover:bg-black/50 rounded text-sm transition" on:click={saveCustomTheme}>保存</button>
              </div>
            </div>
          </div>
        {/if}

        <!-- 共通の保存・キャンセルボタン -->
        <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-black/10">
          <button class="px-5 py-2 bg-black/20 hover:bg-black/30 rounded text-sm transition font-bold" on:click={() => isSettingsOpen = false}>キャンセル</button>
          <button class="px-5 py-2 bg-[var(--accent-color)] text-white rounded text-sm transition font-bold shadow hover:brightness-110" on:click={saveSettings}>設定を保存して閉じる</button>
        </div>
      </div>

    </div>
  </div>
{/if}
<!-- 💥 新規ファイル作成モーダル -->
{#if isNewFileModalOpen}
  <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-96" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">新規ファイル作成</h2>
      
      <div class="mb-4">
        <div class="text-xs opacity-70 mb-1">ファイル名</div>
        <input 
          type="text" 
          class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" 
          bind:value={newFileName} 
          use:selectBaseName
          on:keydown={(e) => e.key === 'Enter' && createNewFileConfirm()}
        />
      </div>

      <div class="mb-6">
        <div class="text-xs opacity-70 mb-1">タグの挿入 (オプション)</div>
        <select class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedTagForNew}>
          <option value="">指定しない</option>
          {#each $registeredTags as tag}<option value={tag}>{tag}</option>{/each}
        </select>
      </div>

      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isNewFileModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={createNewFileConfirm}>作成</button>
      </div>
    </div>
  </div>
{/if}

<!-- 💥 条件で抽出（スマートフォルダ）モーダル -->
{#if isSmartFolderModalOpen}
<div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
    <div class="p-6 rounded shadow-lg border border-black/20 w-[550px] max-h-[90vh] overflow-y-auto" style="background-color: var(--menu-bg); color: var(--text-color);">
      <h2 class="text-lg font-bold mb-4">{editingSmartNode ? '条件を編集' : '条件で抽出'}</h2>
      
      <div class="mb-4 space-y-2">
        <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" bind:value={sfName} placeholder="リストに表示する名前" />
        <div class="flex gap-2">
          <input type="text" class="flex-1 bg-black/5 border border-black/20 rounded p-2 text-sm opacity-70" value={sfTarget} readonly placeholder="抽出元のフォルダ" />
          <button on:click={selectSfTarget} class="px-3 bg-black/10 hover:bg-black/20 rounded text-sm border border-black/20 transition">選択</button>
        </div>
        <label class="flex items-center text-sm cursor-pointer mt-2">
          <input type="checkbox" bind:checked={sfTargetWorkspace} class="mr-2 accent-[var(--accent-color)]"> このワークスペースから抽出する
        </label>
      </div>

      <div class="bg-black/5 p-4 rounded border border-black/10 mb-4">
        <div class="flex justify-between items-center mb-3">
          <select class="bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={sfMatch}>
            <option value="AND">すべての条件を満たす (AND)</option>
            <option value="OR">いずれかの条件を満たす (OR)</option>
          </select>
          <button class="text-sm px-2 py-1 bg-black/10 hover:bg-black/20 rounded transition" on:click={() => sfConds.length < 5 && sfConds.push({ cond_type: 'Tag', tag: '', include_inline: false, is_exclude: false }) && (sfConds = sfConds)} disabled={sfConds.length >= 5}>＋ 条件を追加</button>
        </div>

        <div class="space-y-3">
          {#each sfConds as cond, i}
            <div class="flex flex-col gap-2 p-3 bg-black/5 border border-black/10 rounded relative">
              <button class="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs" on:click={() => { sfConds.splice(i, 1); sfConds = sfConds; }}>✕</button>
              
              <select class="w-48 bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" value={cond.cond_type} on:change={(e) => changeCondType(i, e.target.value)}>
                <option value="Tag">タグ</option>
                <option value="Date">作成日 / 更新日</option>
              </select>

              {#if cond.cond_type === 'Tag'}
                <div class="flex items-center gap-2">
                  <input type="text" class="flex-1 bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" bind:value={cond.tag} placeholder="タグ名 (例: memo)" />
                  <select class="w-24 bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={cond.match_mode}>
                    <option value="contains">部分一致</option>
                    <option value="exact">完全一致</option>
                    <option value="starts">前方一致</option>
                    <option value="ends">後方一致</option>
                  </select>
                  <select class="w-20 bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={cond.is_exclude}>
                    <option value={false}>がある</option><option value={true}>がない</option>
                  </select>
                </div>
                <label class="flex items-center text-xs opacity-70 cursor-pointer"><input type="checkbox" bind:checked={cond.include_inline} class="mr-2 accent-[var(--accent-color)]">本文中のタグも含める</label>
              {:else}
                <div class="flex items-center gap-2">
                  <select class="bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={cond.date_type}>
                    <option value="created">作成日</option><option value="updated">更新日</option>
                  </select>
                  <span class="text-sm">が新しいもの</span>
                  <input type="number" class="w-16 bg-black/10 border border-black/20 rounded p-1 text-sm outline-none" bind:value={cond.limit} min="1" max="100" />
                  <span class="text-sm">件</span>
                </div>
              {/if}
            </div>
          {/each}
          {#if sfConds.length === 0}<div class="text-xs opacity-50 text-center py-2">条件がありません（すべて抽出されます）</div>{/if}
        </div>
      </div>

      <label class="flex items-center text-sm cursor-pointer mb-6">
        <input type="checkbox" bind:checked={sfKeep} class="mr-2 accent-[var(--accent-color)]"> 抽出したものの元のフォルダ構成を維持する
      </label>

      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isSmartFolderModalOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={saveSmartFolder}>{editingSmartNode ? '保存して更新' : '抽出して追加'}</button>
      </div>
    </div>
  </div>
{/if}