<!-- --- START OF src/components/Editor/TabBar.svelte --- -->
<script lang="ts">
  import { openTabs, activeTabId, openFileInNewTab, createNewTab, registeredTags, expandTreeRequest } from '../../lib/stores';
  import { invoke } from '@tauri-apps/api/core';
  import { Search, Plus, X, Tag, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { extractTags, updateTagsInContent } from '../../lib/utils/tagUtils';

  // 親(Editor.svelte)から関数をもらって実行する（親に依存しないための工夫）
  export let handleTabClick: (id: string) => void;
  export let handleTabClose: (id: string) => void;

  let tabMenu = { show: false, x: 0, y: 0, tabId: '', path: '', title: '', content: '', tags: [] as string[], openSubLeft: false };

    // タブをダブルクリックした時の処理
  function handleTabDoubleClick(path: string) {
      // 検索タブなどの特殊なタブ以外なら、ツリー展開を要求する
      if (path && path !== '__SEARCH__') {
          expandTreeRequest.set({ path, timestamp: Date.now() });
      }
  }

  function handleTabContextMenu(e: MouseEvent, tab: any) {
      e.preventDefault();
      let adjustedX = e.clientX;
      if (adjustedX + 200 > window.innerWidth) adjustedX = window.innerWidth - 200;
      const openSubLeft = (adjustedX + 200 + 150) > window.innerWidth;
      tabMenu = { show: true, x: adjustedX, y: e.clientY, tabId: tab.id, path: tab.path, title: tab.title, content: tab.content, tags: extractTags(tab.content), openSubLeft };
  }

  function closeTabMenu() { tabMenu.show = false; }

    // タブをクリックした時に最新のファイル内容を読み込む処理
  async function onTabClick(tab: any) {
      // 未保存状態ではなく、かつ検索タブなどの特殊なタブではない場合のみ最新化
      if (!tab.isDirty && tab.path && tab.path !== '__SEARCH__') {
          try {
              const bytes: number[] = await invoke('read_file_content', { path: tab.path });
              const uint8Array = new Uint8Array(bytes);
              let content = "";
              try { content = new TextDecoder('utf-8', { fatal: true }).decode(uint8Array); } 
              catch { content = new TextDecoder('shift-jis').decode(uint8Array); }

              // 💥 最新の更新日時も取得する
              const modified = (await invoke('get_file_modified', { path: tab.path })) as number;

              openTabs.update(tabs => {
                  const target = tabs.find(t => t.id === tab.id);
                  if (target) {
                      target.content = content;
                      target.lastModified = modified; // 💥 更新日時も最新化
                  }
                  return tabs;
              });
          } catch (err) {
              console.error("最新ファイルの読み込みに失敗しました", err);
              alert(`「${tab.title}」の最新データの取得に失敗しました。ファイルが移動または削除された可能性があります。`);
          }
      }
      
      // 親から渡された本来のタブ切り替え処理を実行
      handleTabClick(tab.id);
  }

   async function operateTagForTab(tag: string, isAdd: boolean) {
      if (!tabMenu.path) { closeTabMenu(); return; }
      const tab = $openTabs.find(t => t.id === tabMenu.tabId);
      if (!tab) { closeTabMenu(); return; }
      
      let content = tab.content;
      
      // tagUtils.ts の関数を使って置換
      const newContent = updateTagsInContent(content, tag, isAdd);

      if (content === newContent) {
          closeTabMenu(); 
          return; 
      }
      content = newContent;

      try {
          // 競合防止用の引数（lastModified, force）を追加
          const newModified = await invoke('save_file_content', { 
              path: tabMenu.path, 
              content, 
              lastModified: tab.lastModified || 0, 
              force: true 
          });
          
          openTabs.update(tabs => { 
              const t = tabs.find(t => t.id === tabMenu.tabId); 
              if (t) { 
                  t.content = content; 
                  t.isDirty = false;
                  t.lastModified = newModified as number; // 💥 追加: 日時も更新
              } 
              return tabs; 
          });
      } catch(err) { 
          alert("タグの保存に失敗しました"); 
      }
      closeTabMenu();
  }
</script>

<svelte:window on:click={closeTabMenu} />

<!-- タブバー本体 -->
<div class="flex border-b border-black/10 flex-wrap select-none" style="background-color: var(--menu-bg);">
  {#each $openTabs as tab}
      <div 
          class="flex items-center px-2 py-1 text-xs max-w-[120px] cursor-pointer border-r border-black/10 border-b transition-colors
                 { $activeTabId === tab.id ? 'border-t-2' : 'border-t-2 border-t-transparent hover:opacity-70' }"
          style="{ $activeTabId === tab.id ? 'background-color: var(--bg-color); color: var(--text-color); border-top-color: var(--accent-color); border-bottom-color: transparent;' : 'background-color: transparent; color: inherit;' }"
          on:click={() => onTabClick(tab)}
          on:contextmenu={(e) => handleTabContextMenu(e, tab)}
          on:dblclick={() => handleTabDoubleClick(tab.path)} 
      >
          {#if tab.path === '__SEARCH__'}
              <Search size={14} class="mr-1.5 opacity-70 shrink-0" />
          {/if}
          <span class="truncate flex-1" title={tab.title}>{tab.title}</span>
          {#if tab.isDirty}
              <span class="ml-1 text-[10px]" style="color: var(--accent-color);">●</span>
          {/if}
          <button class="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 hover:text-red-400 transition" on:click|stopPropagation={() => handleTabClose(tab.id)}>
              <X size={12} />
          </button>
      </div>
  {/each}
  <button class="px-3 py-1 flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 transition" title="新しいタブを開く" on:click={createNewTab}>
      <Plus size={16} />
  </button>
</div>

<!-- タブの右クリックメニュー -->
{#if tabMenu.show}
  <div class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-48" style="left: {tabMenu.x}px; top: {tabMenu.y}px; background-color: var(--menu-bg); color: var(--text-color);">
      {#if tabMenu.path && tabMenu.path !== '__SEARCH__'}
          <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition" on:click={() => { openFileInNewTab(tabMenu.path, tabMenu.title, tabMenu.content); closeTabMenu(); }}>新しいタブで開く</button>
          <hr class="border-black/10 my-1">
          <div class="relative group/tagadd">
               <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center"><span class="flex items-center"><Tag size={14} class="mr-2" /> タグを挿入</span><span>{#if tabMenu.openSubLeft}<ChevronLeft size={14} />{:else}<ChevronRight size={14} />{/if}</span></button>
              <div class="absolute {tabMenu.openSubLeft ? 'right-full -mr-1' : 'left-full -ml-1'} top-0 hidden group-hover/tagadd:block border border-black/20 rounded shadow-xl py-1 w-36" style="background-color: var(--menu-bg);">
                  {#each $registeredTags as tag}<button class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 truncate" on:click={() => operateTagForTab(tag, true)}>{tag}</button>{:else}<div class="px-4 py-1.5 text-sm opacity-50">タグ未登録</div>{/each}
              </div>
          </div>
          <div class="relative group/tagdel">
              <button class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center"><span class="flex items-center"><Tag size={14} class="mr-2" /> タグを削除</span><span>{#if tabMenu.openSubLeft}<ChevronLeft size={14} />{:else}<ChevronRight size={14} />{/if}</span></button>
              <div class="absolute {tabMenu.openSubLeft ? 'right-full -mr-1' : 'left-full -ml-1'} top-0 hidden group-hover/tagdel:block border border-black/20 rounded shadow-xl py-1 w-36" style="background-color: var(--menu-bg);">
                  {#each tabMenu.tags as tag}<button class="block w-full text-left px-4 py-1.5 text-sm text-red-400 hover:bg-black/10 truncate" on:click={() => operateTagForTab(tag, false)}><span class="inline-block w-4">✓</span>{tag}</button>{:else}<div class="px-4 py-1.5 text-sm opacity-50">タグなし</div>{/each}
              </div>
          </div>
      {:else}
          <div class="px-4 py-2 text-sm opacity-50">操作できません</div>
      {/if}
  </div>
{/if}
<!-- --- END OF src/components/Editor/TabBar.svelte --- -->