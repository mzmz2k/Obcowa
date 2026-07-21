<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInCurrentTab, openFileInNewTab, activeTabId, openTabs, switchTab, registeredTags, expandTreeRequest } from '../lib/stores'; 
  import { getContext } from 'svelte';
  import { ChevronDown, ChevronRight, Library, FolderOpen, Folder, FileText, Tag, Pin, PinOff, Search, Pencil, ArrowUpDown, ExternalLink } from 'lucide-svelte';

  import { extractTags, updateTagsInContent } from '../lib/utils/tagUtils';

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

  $: sortedChildren = [...(node.children || [])].sort((a, b) => {
    const isDirA = a.type === 'Folder';
    const isDirB = b.type === 'Folder';
    if (isDirA !== isDirB) return isDirA ? -1 : 1;

    let comp = 0;
    if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
    else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
    else comp = a.name.localeCompare(b.name);
    
    return sortOrder === 'asc' ? comp : -comp;
  });

  async function handleClick() {
    if (node.type === 'Folder') {
          isOpen = !isOpen;
      // 💥 変更: !node.smart_rules を追加し、スマートフォルダの場合はこの処理をスキップさせる
      if (isOpen && node.children && node.children.length === 0 && node.original_path && !node.smart_rules) {
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
      await invoke('save_file_content', { path: node.path, content });
      openTabs.update(tabs => {
        const tab = tabs.find(t => t.path === node.path);
        if (tab) {
          tab.content = content;
          tab.isDirty = false;
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

  function createNewFileInFolder() {
    openNewFileModal(node.original_path, async () => {
      isOpen = true;
      node.children = await invoke('read_directory', { path: node.original_path });
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
    <div 
      class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-48"
      style="left: {menuX}px; top: {menuY}px; background-color: var(--menu-bg); color: var(--text-color);"
    >
      {#if node.type === 'File'}
        <button 
          class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
          on:click={async () => {
            const content = await loadFileContent(node.path);
            openFileInNewTab(node.path, node.name, content);
            closeMenu();
          }}
        >
          新しいタブで開く
        </button>

        <hr class="border-black/10 my-1">

        <!-- タグ挿入サブメニュー -->
        <div class="relative group/tagadd">
          <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
            <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを挿入</span>
            <ChevronRight size={14} />
          </button>
          <div class="absolute left-full top-0 hidden group-hover/tagadd:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            {#each $registeredTags as tag}
              <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 truncate" on:click={() => operateTag(tag, true)}>
                {tag}
              </button>
            {:else}
              <div class="px-4 py-1.5 text-sm opacity-50">タグ未登録</div>
            {/each}
          </div>
        </div>
        

        <!-- 💥 追加: タグ削除サブメニュー -->
        <div class="relative group/tagdel">
          <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
            <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを削除</span>
            <ChevronRight size={14} />
          </button>
          <div class="absolute left-full top-0 hidden group-hover/tagdel:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            {#each currentFileTags as tag}
              <button class="block w-full text-left px-4 py-1.5 text-sm text-red-400 hover:bg-black/10 truncate" on:click={() => operateTag(tag, false)}>
                <span class="inline-block w-4">✓</span>{tag}
              </button>
            {:else}
              <div class="px-4 py-1.5 text-sm opacity-50">タグなし</div>
            {/each}
          </div>
        </div>

        <hr class="border-black/10 my-1">
      
      {/if}

      <!-- 変更：ピン留め状態によって「ピン留め」と「解除」を切り替え -->
      {#if checkIsPinned(node)}
        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-[var(--accent-color)] hover:brightness-110 hover:bg-black/10 transition"
          on:click={() => { unpinNode(node); closeMenu(); }}
        >
          <PinOff size={14} class="mr-2" /> ピン留め解除
        </button>
      {:else}
        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-[var(--accent-color)] hover:brightness-110 hover:bg-black/10 transition"
          on:click={() => { pinNode(node); closeMenu(); }}
        >
          <Pin size={14} class="mr-2" /> ピン留め
        </button>
      {/if}

     <!-- 新規追加：フォルダ専用メニュー -->
      {#if node.type === 'Folder'}
        <!-- 💥 変更: isReadonlyではなく、仮想のガワ以外ならフル操作可能にする -->
        {#if !node.is_virtual_wrapper}
          
          <!-- 💥 スマートフォルダの場合は「条件を編集」にする -->
          {#if node.smart_rules}
            <button 
              class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
              on:click={() => { editSmartFolder(node); closeMenu(); }}
            >
              <Search size={14} class="mr-2" /> 条件を編集
            </button>
          {:else}
            <!-- 普通のフォルダの場合は今まで通り -->
            <button 
              class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
              on:click={() => { renameFolder(); closeMenu(); }}
            >
              <Pencil size={14} class="mr-2" /> 表示名を変更
            </button>
            
            {#if node.original_path}
              <button 
                class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
                on:click={() => { createNewFileInFolder(); closeMenu(); }}
              >
                <FileText size={14} class="mr-2" /> 新規ファイル作成
              </button>
            {/if}
          {/if}
      <!-- フォルダの場合にソートサブメニューを追加 -->
      {#if node.type === 'Folder'}
        <div class="relative group/sort">
          <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
            <span class="flex items-center"><ArrowUpDown size={14} class="mr-2" /> ソート順変更</span>
            <ChevronRight size={14} />
          </button>
          
          <div class="absolute left-full top-0 hidden group-hover/sort:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10" on:click={() => { setNodeSort(node, sortBy, 'asc'); closeMenu(); }}>
              <span class="inline-block w-4">{sortOrder !== 'desc' ? '✓' : ''}</span>昇順
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10" on:click={() => { setNodeSort(node, sortBy, 'desc'); closeMenu(); }}>
              <span class="inline-block w-4">{sortOrder === 'desc' ? '✓' : ''}</span>降順
            </button>
            <hr class="border-black/10 my-1">
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10" on:click={() => { setNodeSort(node, 'name', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'name' ? '✓' : ''}</span>名前
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10" on:click={() => { setNodeSort(node, 'created', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'created' ? '✓' : ''}</span>作成日
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10" on:click={() => { setNodeSort(node, 'modified', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'modified' ? '✓' : ''}</span>更新日
            </button>
          </div>
        </div>
        <hr class="border-black/10 my-1">
      {/if}
        {/if}

        {#if node.original_path}
          <button 
            class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition"
            on:click={() => { openInExplorer(); closeMenu(); }}
          >
            <ExternalLink size={14} class="mr-2" /> エクスプローラーで開く
          </button>
        {/if}
      {/if}

      <!-- 💥 仮想のガワ以外なら表示 -->
      {#if !node.is_virtual_wrapper}

        <!-- 💥 追加: ライブラリに登録 (現在のワークスペースのノードのみ表示) -->
        {#if !isLibraryNode}
          <div class="relative group/library">
            <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center">
              <span class="flex items-center"><Library size={14} class="mr-2" /> ライブラリに登録</span>
              <ChevronRight size={14} />
            </button>
            <div class="absolute left-full top-0 hidden group-hover/library:block border border-black/20 rounded shadow-xl py-1 w-48 -ml-1" style="background-color: var(--menu-bg);">
              <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 font-bold" on:click={() => { addNodeToLibrary(node, 'new'); closeMenu(); }}>
                 ＋ 新しいライブラリを作成
              </button>
              <hr class="border-black/10 my-1">
              {#each getLibraries() as lib}
                <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 truncate" on:click={() => { addNodeToLibrary(node, lib.id); closeMenu(); }}>
                   {lib.name}
                </button>
              {:else}
                <div class="px-4 py-1.5 text-xs opacity-50">既存ライブラリなし</div>
              {/each}
            </div>
          </div>
          <hr class="border-black/10 my-1">
        {/if}

        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-black/10 transition"
          on:click={() => { removeNode(node, ownerId); closeMenu(); }}
        >
          <!-- 💥 ライブラリ内なら解除、通常なら削除と表記を変える -->
          {#if isLibraryNode}
            ライブラリ登録解除
          {:else}
            リストから削除
          {/if}
        </button>
      {/if}
      
    </div>
  {/if}

  {#if isOpen && sortedChildren && sortedChildren.length > 0}
    <div class="border-l border-black/10 ml-2 pl-1">
      {#each sortedChildren as childNode}
        <svelte:self node={childNode} {ownerId} {isLibraryNode} />
      {/each}
    </div>
  {/if}

</div>