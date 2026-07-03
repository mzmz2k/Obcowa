<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { openFileInCurrentTab, openFileInNewTab, activeTabId, openTabs, switchTab, registeredTags } from '../lib/stores'; 
  import { getContext } from 'svelte';
  import { ChevronDown, ChevronRight, Library, FolderOpen, Folder, FileText, Tag, Pin, PinOff, Search, Pencil, ArrowUpDown, ExternalLink } from 'lucide-svelte';

  export let node: any;
  // 💥 変更: isReadonly を削除し、親から引き継ぐ情報に変更
  export let ownerId: string;
  export let isLibraryNode = false;
  let isOpen = false;

  // 💥 追加: コンテキストアクションから新しい関数も受け取る
  const { removeNode, pinNode, unpinNode, checkIsPinned, getClickBehavior, saveWorkspace, editSmartFolder, openNewFileModal, getGlobalSort, setNodeSort, getLibraries, addNodeToLibrary } = getContext('workspaceActions') as any;

  // 現在アクティブなタブの path と一致しているか判定
  $: activeTab = $openTabs.find(t => t.id === $activeTabId);
  $: isActive = activeTab && activeTab.path === node.path;

  // 💥 右クリックメニューの状態
  let showMenu = false;
  let menuX = 0;
  let menuY = 0;

   // 💥 追加: 対象ファイルの現在のタグを保持する変数
  let currentFileTags: string[] = [];


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

  // 💥 変更: あらゆる形式（インライン・リスト）のタグを読み取る関数
  function extractTags(content: string) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tags: string[] = [];
    if (match) {
      const lines = match[1].split(/\r?\n/);
      let inTags = false;
      
      for (const line of lines) {
        if (line.startsWith('tags:') || line.startsWith('tag:')) {
          inTags = true;
          // tags: [A, B] のようなインライン形式も拾う
          const inlineStr = line.substring(line.indexOf(':') + 1).trim();
          if (inlineStr) {
            tags.push(...inlineStr.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(t => t));
            inTags = false; 
          }
          continue;
        }
        
        // リスト形式（- A）を拾う
        if (inTags) {
          if (line.trim().startsWith('- ')) {
            tags.push(line.trim().substring(2).trim());
          } else if (line.trim() !== '' && !line.startsWith(' ')) {
            inTags = false; // 次のプロパティ（aliases:など）が始まったらタグブロック終了
          }
        }
      }
    }
    return [...new Set(tags)]; // 重複を排除して返す
  }

  // 💥 変更: タグの追加・削除を実行し、常にリスト形式で書き込む
  async function operateTag(tag: string, isAdd: boolean) {
    let content = await getTargetContent();
    let tags = extractTags(content);
    
    if (isAdd) {
      if (tags.includes(tag)) { closeMenu(); return; }
      tags.push(tag);
    } else {
      if (!tags.includes(tag)) { closeMenu(); return; }
      tags = tags.filter(t => t !== tag);
    }

    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      let fm = match[1];
      let newFmLines: string[] = [];
      const lines = fm.split(/\r?\n/);
      let inTagsBlock = false;
      let hasTags = false;

      for (const line of lines) {
        // タグの記述を見つけたら、新しいリスト形式で展開して書き換える
        if (line.startsWith('tags:') || line.startsWith('tag:')) {
          inTagsBlock = true;
          hasTags = true;
          if (tags.length > 0) {
            newFmLines.push(`tags:`);
            tags.forEach(t => newFmLines.push(`  - ${t}`));
          }
          continue;
        }
        
        // 古いタグの記述行はスキップ（消去）する
        if (inTagsBlock) {
          if (line.trim().startsWith('- ') || line.trim() === '') {
            continue;
          } else if (!line.startsWith(' ') && line.includes(':')) {
            inTagsBlock = false; 
          }
        }
        
        if (!inTagsBlock) newFmLines.push(line);
      }

      // プロパティ自体はあるが tags が無かった場合
      if (!hasTags && tags.length > 0) {
        newFmLines.push(`tags:`);
        tags.forEach(t => newFmLines.push(`  - ${t}`));
      }

      content = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFmLines.join('\n')}\n---`);
    } else {
      // プロパティが存在しない場合は先頭に作成する
      if (tags.length > 0) {
        let tagsYaml = `tags:\n` + tags.map(t => `  - ${t}`).join('\n');
        content = `---\n${tagsYaml}\n---\n\n${content}`;
      }
    }

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
          class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
          on:click={async () => {
            const content = await loadFileContent(node.path);
            openFileInNewTab(node.path, node.name, content);
            closeMenu();
          }}
        >
          新しいタブで開く
        </button>

        <hr class="border-gray-700 my-1">

        <!-- 💥 追加: タグ挿入サブメニュー -->
          <button class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition flex justify-between items-center">
            <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを挿入</span>
            <ChevronRight size={14} />
          </button>
          <!-- 💥 変更: group-hover/tagadd に変更 -->
          <div class="absolute left-full top-0 hidden group-hover/tagadd:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            {#each $registeredTags as tag}
              <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700 truncate" on:click={() => operateTag(tag, true)}>
                {tag}
              </button>
            {:else}
              <div class="px-4 py-1.5 text-sm text-gray-500">タグ未登録</div>
            {/each}
          </div>
        

        <!-- 💥 追加: タグ削除サブメニュー -->
        <div class="relative group/tagdel">
          <button class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition flex justify-between items-center">
            <span class="flex items-center"><Tag size={14} class="mr-2" /> タグを削除</span>
            <ChevronRight size={14} />
          </button>
          <!-- 💥 変更: group-hover/tagdel に変更 -->
          <div class="absolute left-full top-0 hidden group-hover/tagdel:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            {#each currentFileTags as tag}
              <button class="block w-full text-left px-4 py-1.5 text-sm text-red-300 hover:bg-gray-700 truncate" on:click={() => operateTag(tag, false)}>
                <span class="inline-block w-4">✓</span>{tag}
              </button>
            {:else}
              <div class="px-4 py-1.5 text-sm text-gray-500">タグなし</div>
            {/each}
          </div>
        </div>

        <hr class="border-gray-700 my-1">
      
      {/if}

      <!-- 変更：ピン留め状態によって「ピン留め」と「解除」を切り替え -->
      {#if checkIsPinned(node)}
        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-gray-700 transition"
          on:click={() => { unpinNode(node); closeMenu(); }}
        >
          <PinOff size={14} class="mr-2" /> ピン留め解除
        </button>
      {:else}
        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-gray-700 transition"
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
              class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
              on:click={() => { editSmartFolder(node); closeMenu(); }}
            >
              <Search size={14} class="mr-2" /> 条件を編集
            </button>
          {:else}
            <!-- 普通のフォルダの場合は今まで通り -->
            <button 
              class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
              on:click={() => { renameFolder(); closeMenu(); }}
            >
              <Pencil size={14} class="mr-2" /> 表示名を変更
            </button>
            
            {#if node.original_path}
              <button 
                class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
                on:click={() => { createNewFileInFolder(); closeMenu(); }}
              >
                <FileText size={14} class="mr-2" /> 新規ファイル作成
              </button>
            {/if}
          {/if}
      <!-- フォルダの場合にソートサブメニューを追加 -->
      {#if node.type === 'Folder'}
        <div class="relative group/sort">
          <button class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition flex justify-between items-center">
            <span class="flex items-center"><ArrowUpDown size={14} class="mr-2" /> ソート順変更</span>
            <ChevronRight size={14} />
          </button>
          
          <!-- サブメニュー (ホバーで出現) -->
         <!-- 💥 group-hover:block を group-hover/sort:block に修正しました -->
          <div class="absolute left-full top-0 hidden group-hover/sort:block border border-black/20 rounded shadow-xl py-1 w-36 -ml-1" style="background-color: var(--menu-bg);">
            
            <!-- 💥 変更: 同様に固定幅の <span> に変更 -->
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700" on:click={() => { setNodeSort(node, sortBy, 'asc'); closeMenu(); }}>
              <span class="inline-block w-4">{sortOrder !== 'desc' ? '✓' : ''}</span>昇順
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700" on:click={() => { setNodeSort(node, sortBy, 'desc'); closeMenu(); }}>
              <span class="inline-block w-4">{sortOrder === 'desc' ? '✓' : ''}</span>降順
            </button>
            
            <hr class="border-gray-600 my-1">
            
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700" on:click={() => { setNodeSort(node, 'name', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'name' ? '✓' : ''}</span>名前
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700" on:click={() => { setNodeSort(node, 'created', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'created' ? '✓' : ''}</span>作成日
            </button>
            <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700" on:click={() => { setNodeSort(node, 'modified', sortOrder); closeMenu(); }}>
              <span class="inline-block w-4">{sortBy === 'modified' ? '✓' : ''}</span>更新日
            </button>
          </div>
        </div>
        <hr class="border-gray-700 my-1">
      {/if}
        {/if}

        {#if node.original_path}
          <button 
            class="flex items-center w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition"
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
            <button class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition flex justify-between items-center">
              <span class="flex items-center"><Library size={14} class="mr-2" /> ライブラリに登録</span>
              <ChevronRight size={14} />
            </button>
            <div class="absolute left-full top-0 hidden group-hover/library:block border border-black/20 rounded shadow-xl py-1 w-48 -ml-1" style="background-color: var(--menu-bg);">
              <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700 font-bold" on:click={() => { addNodeToLibrary(node, 'new'); closeMenu(); }}>
                 ＋ 新しいライブラリを作成
              </button>
              <hr class="border-gray-700 my-1">
              {#each getLibraries() as lib}
                <button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-gray-700 truncate" on:click={() => { addNodeToLibrary(node, lib.id); closeMenu(); }}>
                   {lib.name}
                </button>
              {:else}
                <div class="px-4 py-1.5 text-xs text-gray-500">既存ライブラリなし</div>
              {/each}
            </div>
          </div>
          <hr class="border-gray-700 my-1">
        {/if}

        <button 
          class="flex items-center w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition"
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
    <div class="border-l border-gray-600 ml-2 pl-1">
      {#each sortedChildren as childNode}
        <svelte:self node={childNode} {ownerId} {isLibraryNode} />
      {/each}
    </div>
  {/if}

</div>