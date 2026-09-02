<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInCurrentTab, openFileInNewTab, activeTabId, openTabs, switchTab, registeredTags, expandTreeRequest } from '../lib/stores'; 
  import { getContext, tick } from 'svelte';
  import { ChevronDown, ChevronRight, Library, FolderOpen, Folder, FileText, Tag, Pin, PinOff, Search, Pencil, ArrowUpDown, ExternalLink } from 'lucide-svelte';

  import { extractTags, updateTagsInContent } from '../lib/utils/tagUtils';
  import ContextMenu from '../features/ContextMenu.svelte';
  import { buildCommonFileMenu, type MenuItem } from '../lib/workspace/menuUtils';

    // コンテキストアクションから新しい関数も受け取る
  const { removeNode, pinNode, unpinNode, checkIsPinned, getClickBehavior, saveWorkspace, editSmartFolder, openNewFileModal, getGlobalSort, setNodeSort, getLibraries, addNodeToLibrary } = getContext('workspaceActions') as any;

  export let node: any;
  // isReadonly を削除し、親から引き継ぐ情報に変更
  export let ownerId: string;
  export let isLibraryNode = false;
  let isOpen = false;

  $: activeTab = $openTabs.find(t => t.id === $activeTabId);
  $: isActive = activeTab && activeTab.path === node.path;

    // 💥 右クリックメニューの状態
  let showMenu = false;
  let menuX = 0;
  let menuY = 0;
  let menuItems: MenuItem[] = [];

     // 💥対象ファイルの現在のタグを保持する変数
  let currentFileTags: string[] = [];

    // 目的のファイルが見つかった際に画面内へ自動スクロールさせるための要素参照と、処理済みの記録
  let nodeElement: HTMLDivElement;
  let lastProcessedTimestamp = 0; 
  let lastScrolledTimestamp = 0;



  // 💥 追加: スマートフォルダ用に、自分の中身(子や孫)に目的のファイルが含まれているか調べる関数
  function containsPath(folderNode: any, targetPath: string): boolean {
    if (!folderNode.children) return false;
    for (const child of folderNode.children) {
      if (child.type === 'File' && child.path === targetPath) return true;
      if (child.type === 'Folder' && containsPath(child, targetPath)) return true;
    }
    return false;
  }

  // 💥 変更: ツリー展開リクエストの監視（バグ修正とスマートフォルダ対応）
  $: if ($expandTreeRequest && node.type === 'Folder') {
      const req = $expandTreeRequest;
      
      // 同じリクエストで何度も処理が暴走する（閉じられなくなる）のを防ぐ
      if (lastProcessedTimestamp !== req.timestamp) {
          let shouldOpen = false;

          if (node.smart_rules || node.is_virtual_wrapper) {
              // スマートフォルダなどは、すでに中に入っているファイル一覧から探す
              shouldOpen = containsPath(node, req.path);
          } else if (node.original_path) {
              // 普通のフォルダは、今まで通りパスの前方一致で判定する
              shouldOpen = req.path.startsWith(node.original_path + '/') || req.path.startsWith(node.original_path + '\\');
          }

          if (shouldOpen) {
              isOpen = true;
              lastProcessedTimestamp = req.timestamp; // 💥 一度開いたら記録をつける

              // 普通のフォルダでまだ中身を読み込んでいない場合はバックエンドから読み込む
              if (node.children && node.children.length === 0 && node.original_path && !node.smart_rules) {
                  invoke('read_directory', { path: node.original_path }).then(res => {
                      node.children = res as any[];
                  }).catch(e => console.error("フォルダ自動展開エラー:", e));
              }
          }
      }
  }

  // 💥 変更: 目的のファイルノードに到達したらスクロール（何度もスクロールしないように修正）
  $: if ($expandTreeRequest && node.type === 'File' && node.path === $expandTreeRequest.path) {
      if (nodeElement && lastScrolledTimestamp !== $expandTreeRequest.timestamp) {
          lastScrolledTimestamp = $expandTreeRequest.timestamp;
          setTimeout(() => {
              nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
      }
  }

  // 💥 追加: 現在のソート設定（個別設定があれば優先、なければ全体設定）を計算し、常にソートされた配列を作る
  $: globalSort = getGlobalSort();
  $: sortBy = node.sort_by || globalSort.by;
  $: sortOrder = node.sort_order || globalSort.order;

  // 💥 高速化したソート処理（localeCompare を廃止し、シンプルな比較に差し替え）
  $: sortedChildren = [...(node.children || [])].sort((a, b) => {
    const isDirA = a.type === 'Folder';
    const isDirB = b.type === 'Folder';
    if (isDirA !== isDirB) return isDirA ? -1 : 1;

    let comp = 0;
    if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
    else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
    else {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comp = nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
    }
    
    return sortOrder === 'asc' ? comp : -comp;
  });

  async function handleClick() {
    if (node.type === 'Folder') {
          isOpen = !isOpen;
      // 💥 変更: !node.smart_rules を追加し、スマートフォルダの場合はこの処理をスキップさせる
      if (isOpen && node.children && node.children.length === 0 && node.original_path && !node.smart_rules) {
        try {
          node.children = await invoke('read_directory', { 
              path: node.original_path,
              sortBy,
              sortOrder
          });
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
  async function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (node.type === 'File') {
      try {
        const content = await getTargetContent();
        currentFileTags = extractTags(content);
      } catch(err) {
        console.error("タグ取得失敗:", err);
      }
    }
    // 💥 追加: メニューが画面下部にはみ出さないようにY座標を調整
    // メニューの想定最大高さを約 400px として計算
    let adjustedY = e.clientY;
    const estimatedMenuHeight = 400;
    
    if (adjustedY + estimatedMenuHeight > window.innerHeight) {
        // 下にはみ出る場合は、画面下端に収まるように上にずらす
        adjustedY = Math.max(0, window.innerHeight - estimatedMenuHeight);
    }

    // ==== メニュー項目の構築 ====
    const items: MenuItem[] = [];

    if (node.type === 'File') {
      items.push(...buildCommonFileMenu({
        registeredTags: $registeredTags,
        currentFileTags,
        onOpenInNewTab: async () => {
          const content = await loadFileContent(node.path);
          openFileInNewTab(node.path, node.name, content);
        },
        onAddTag: (tag) => operateTag(tag, true),
        onRemoveTag: (tag) => operateTag(tag, false)
      }));
    }

    // ピン留め
    items.push({
      label: checkIsPinned(node) ? 'ピン留め解除' : 'ピン留め',
      icon: checkIsPinned(node) ? PinOff : Pin,
      accent: true,
      action: () => checkIsPinned(node) ? unpinNode(node) : pinNode(node)
    });

    // フォルダ専用メニュー
    if (node.type === 'Folder' && !node.is_virtual_wrapper) {
      if (node.smart_rules) {
        items.push({ label: '条件を編集', icon: Search, action: () => editSmartFolder(node) });
      } else {
        items.push({ label: '表示名を変更', icon: Pencil, action: () => renameFolder() });
        if (node.original_path) {
          items.push({ label: '新規ファイル作成', icon: FileText, action: () => createNewFileInFolder() });
        }
      }
      
      items.push({
        label: 'ソート順変更',
        icon: ArrowUpDown,
        submenu: [
          { label: '昇順', checked: sortOrder !== 'desc', action: () => setNodeSort(node, sortBy, 'asc') },
          { label: '降順', checked: sortOrder === 'desc', action: () => setNodeSort(node, sortBy, 'desc') },
          { divider: true },
          { label: '名前', checked: sortBy === 'name', action: () => setNodeSort(node, 'name', sortOrder) },
          { label: '作成日', checked: sortBy === 'created', action: () => setNodeSort(node, 'created', sortOrder) },
          { label: '更新日', checked: sortBy === 'modified', action: () => setNodeSort(node, 'modified', sortOrder) },
        ]
      });
      items.push({ divider: true });
    }

    if (node.type === 'Folder' && node.original_path) {
      items.push({ label: 'エクスプローラーで開く', icon: ExternalLink, action: () => openInExplorer() });
    }
    
    if (!node.is_virtual_wrapper) {
      if (!isLibraryNode) {
        const libs = getLibraries();
        items.push({
          label: 'ライブラリに登録',
          icon: Library,
          submenu: [
            { label: '＋ 新しいライブラリを作成', bold: true, action: () => addNodeToLibrary(node, 'new') },
            { divider: true },
            ...(libs.length > 0 ? libs.map((lib: any) => ({
              label: lib.name,
              action: () => addNodeToLibrary(node, lib.id)
            })) : [{ label: '既存ライブラリなし', disabled: true }])
          ]
        });
        items.push({ divider: true });
      }

      items.push({
        label: isLibraryNode ? 'ライブラリ登録解除' : 'リストから削除',
        danger: true,
        action: () => removeNode(node, ownerId)
      });
    }

    menuItems = items;

    showMenu = true;
    menuX = e.clientX;
    menuY = adjustedY;
  }

  // 💥 追加: ファイルの中身を取得（タブで開いていればタブの未保存データ、なければ実際のファイルから）
  async function getTargetContent() {
    const tab = $openTabs.find(t => t.path === node.path);
    if (tab) return tab.content;
    return await loadFileContent(node.path);
  }



 // 💥 変更: operateTag の中身を大幅にスリム化
  async function operateTag(tag: string, isAdd: boolean) {
    let content = await getTargetContent();
    
    // 💥 追加: ロジック専用ファイルに文字列処理を任せる
    const newContent = updateTagsInContent(content, tag, isAdd);
    
    // 変更がなければ何もせずに閉じる
    if (content === newContent) {
      closeMenu();
      return;
    }
    content = newContent;


    // 保存処理
    try {
      // 引数に lastModified と force を追加
      const newModified = await invoke('save_file_content', { 
        path: node.path, 
        content,
        lastModified: 0, // ツリーからの直接操作なので0でOK
        force: true      // ユーザーの明示的な操作なので強制上書き
      });
      
      openTabs.update(tabs => {
        const tab = tabs.find(t => t.path === node.path);
        if (tab) {
          tab.content = content;
          tab.isDirty = false;
          tab.lastModified = newModified as number; // タブを開いていた場合は日時も更新
        }
        return tabs;
      });
    } catch(err) {
      alert("タグの保存に失敗しました");
    }
    closeMenu();
  }

  function closeMenu() {
    showMenu = false;
  }

async function loadFileContent(path: string): Promise<string> {
    return await invoke<string>('read_file_content', { path });
}

  async function renameFolder() {
    const newName = prompt("リストに表示する名前を入力してください（実フォルダ名は変わりません）", node.name);
    if (newName && newName.trim() !== '') {
      node.name = newName;
      await tick();
      saveWorkspace();
    }
  }

  function createNewFileInFolder() {
    openNewFileModal(node.original_path, async () => {
      isOpen = true;
      node.children = await invoke('read_directory', { path: node.original_path });
      await tick();
      saveWorkspace();
    });
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
    bind:this={nodeElement}
    class="flex items-center p-1 rounded text-sm cursor-pointer select-none transition-colors 
           {isActive ? 'font-bold' : 'hover:opacity-70'}"
    style="{isActive ? 'background-color: var(--active-highlight-bg); color: var(--text-color);' : 'background-color: transparent; color: inherit;'}"
    on:click={handleClick}
    on:contextmenu={handleContextMenu}
  >
    <span class="mr-1.5 flex items-center justify-center w-4">
      {#if node.type === 'Folder'}
        {#if node.is_virtual_wrapper}
          <Library size={14} />
        {:else}
          {#if isOpen}<FolderOpen size={14} />{:else}<Folder size={14} />{/if}
        {/if}
      {:else}
        <FileText size={14} />
      {/if}
    </span>


    <span class="truncate">{node.name}</span>
  </div>

 <!-- 💥 カスタムコンテキストメニュー -->
  {#if showMenu}

    <ContextMenu 
      x={menuX} 
      y={menuY} 
      items={menuItems} 
      onClose={closeMenu} 
    />

  {/if}

  {#if isOpen && sortedChildren && sortedChildren.length > 0}
    <div class="border-l border-black/10 ml-2 pl-1">
      {#each sortedChildren as childNode}
        <svelte:self node={childNode} {ownerId} {isLibraryNode} />
      {/each}
    </div>
  {/if}

</div>