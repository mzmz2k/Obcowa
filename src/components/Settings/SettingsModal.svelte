<!-- --- START OF src/components/SettingsModal.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import StyleSettings from './StyleSettings.svelte';
  import { activeStyleSlot, customStyleSlots, defaultStyle, applyStyleToRoot } from '../../features/styleSettings/styleStore';
  import { activeTheme, type Theme } from '../../lib/settings/theme';
  import { editorFont, registeredTags, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';

  import { showLauncherOnStartup } from '../../lib/stores';
  import { invoke } from '@tauri-apps/api/core';
  import { requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';
  import { X } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  let tempFont = $editorFont || 'sans-serif';
  let activeSettingsTab = 'general';
  
  let tempTheme: Theme = { ...$activeTheme };

    // スタイルの編集用の一時データ
  let tempStyle = JSON.parse(JSON.stringify($activeStyleSlot));
  let tempCustomSlots = JSON.parse(JSON.stringify($customStyleSlots));

  let newTagInput = '';
  let selectedTagToRemove = '';

  // タグ管理の処理
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

  // タスク除外ファイルの解除処理
  function removeExcludePath(pathToRemove: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.task_exclude_paths) {
        current.task_exclude_paths = current.task_exclude_paths.filter((p: string) => p !== pathToRemove);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }

  // タスク除外見出しの解除処理
  function removeExcludeHeading(headingToRemove: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.task_exclude_headings) {
        current.task_exclude_headings = current.task_exclude_headings.filter((h: string) => h !== headingToRemove);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }


  // 画像フォルダの選択ダイアログ
  async function selectImageFolder() {
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      workspacesStore.update(ws => {
        const current = ws[$currentWorkspaceIndex];
        if (current) {
          if (!current.image_folders) current.image_folders = [];
          if (!current.image_folders.includes(selectedPath)) {
            current.image_folders = [...current.image_folders, selectedPath];
          }
        }
        return ws;
      });
      requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
    }
  }

  // 画像フォルダの削除
  function removeImageFolder(folder: string) {
    workspacesStore.update(ws => {
      const current = ws[$currentWorkspaceIndex];
      if (current && current.image_folders) {
        current.image_folders = current.image_folders.filter((f: string) => f !== folder);
      }
      return ws;
    });
    requestSaveWorkspaces(); // ★即時反映される操作はその場でキューに入れて安全に保存
  }


  // 設定を確定して閉じる（Obsidian風オートセーブ）
  function handleClose() {

    // テーマの保存
    $activeTheme = { ...tempTheme };
    localStorage.setItem('activeTheme', JSON.stringify($activeTheme));

    // スタイルの保存と適用
    $activeStyleSlot = tempStyle;
    $customStyleSlots = tempCustomSlots;
    localStorage.setItem('activeStyle', JSON.stringify(tempStyle));
    localStorage.setItem('customStyleSlots', JSON.stringify(tempCustomSlots));
    applyStyleToRoot(tempStyle);

    workspacesStore.update(ws => {
      if (ws[$currentWorkspaceIndex]) {
        ws[$currentWorkspaceIndex].editor_font = tempStyle.editorFont;
      }
      return ws;
    });

    // ★ワークスペースマネージャーに安全な保存を要求する
    requestSaveWorkspaces();
    dispatch('close');
  }

  // ランチャー画面の設定
function toggleLauncherSetting() {
    const newValue = !$showLauncherOnStartup;
    showLauncherOnStartup.set(newValue);
    localStorage.setItem('showLauncherOnStartup', newValue.toString());
}

async function openLauncherWindow() {
    await invoke('open_launcher');
}

  // Escキーで閉じる
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

</script>


<svelte:window on:keydown={handleKeydown} />

<!-- 背景クリックでも閉じられるオーバーレイ -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center" on:click|self={handleClose}>
  <div class="rounded-lg shadow-2xl border border-black/20 flex overflow-hidden w-[750px] h-[600px] relative" style="background-color: var(--menu-bg); color: var(--text-color);">
     
    <!-- ★追加: Obsidian風の右上の閉じる（×）ボタン -->
    <button 
      class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/10 transition opacity-70 hover:opacity-100 z-10"
      style="color: var(--text-color);"
      title="閉じる (Esc)"
      on:click={handleClose}
    >
      <X size={18} />
    </button>

    
    <!-- 左サイドバー（タブ） -->
    <div class="w-1/4 bg-black/10 p-4 space-y-2 text-sm border-r border-black/10">
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'general' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'general'}>一般</button>
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'theme' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'theme'}>テーマ</button>
       <!-- スタイルタブのボタン -->
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'style' ? 'bg-[var(--active-highlight-bg)] text-[var(--text-color)] font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'style'}>スタイル</button>
    </div>

    <!-- 右コンテンツ -->
    <div class="w-3/4 p-6 overflow-y-auto flex flex-col relative">
      
      {#if activeSettingsTab === 'general'}
        <h2 class="text-lg font-bold mb-6">一般設定</h2>
      
        <!-- 画像フォルダの設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">添付ファイル（画像）の保存フォルダ (複数指定可)</div>
          <ul class="mb-2 space-y-1">
            {#each $workspacesStore[$currentWorkspaceIndex]?.image_folders || [] as folder}
              <li class="flex justify-between items-center bg-black/5 border border-black/20 rounded p-2 text-sm opacity-80">
                <span class="truncate" title={folder}>{folder}</span>
                <button class="text-red-400 hover:text-red-500 font-bold px-2" on:click={() => removeImageFolder(folder)}>×</button>
              </li>
            {/each}
          </ul>
          <div class="flex gap-2">
            <button on:click={selectImageFolder} class="w-full px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm border border-black/20 transition text-center">＋ フォルダを追加</button>
          </div>
          <div class="text-xs opacity-50 mt-1">※上から順に画像を検索します。指定しない場合はファイルと同じ場所を探します。</div>
        </div>
        
        <!-- プロパティ表示設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">エディタ表示設定 (現在のワークスペース)</div>
          <label class="flex items-center space-x-2 cursor-pointer bg-black/5 border border-black/20 rounded p-3 hover:bg-black/10 transition">
            <input 
              type="checkbox" 
              class="rounded"
              checked={$workspacesStore[$currentWorkspaceIndex]?.show_properties ?? false} 
              on:change={(e) => {
                const checked = e.currentTarget.checked;
                workspacesStore.update(ws => {
                  if (ws[$currentWorkspaceIndex]) ws[$currentWorkspaceIndex].show_properties = checked;
                  return ws;
                });
              }} 
            />
            <span class="text-sm">プレビューでファイルのプロパティ（フロントマター）を表示する</span>
          </label>
        </div>

        <!-- ランチャーの設定エリア -->
        <div class="mb-6">
    <h3 class="text-lg font-bold mb-3 border-b border-gray-600 pb-1">起動設定</h3>
    <div class="flex items-center justify-between bg-[var(--menu-bg)] p-3 rounded">
        <div>
            <div class="font-medium">ワークスペース一覧 (ランチャー)</div>
            <label class="flex items-center space-x-2 mt-2 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={$showLauncherOnStartup} 
                    on:change={toggleLauncherSetting} 
                />
                <span class="text-sm opacity-80">起動時にこの画面を開いて選択する</span>
            </label>
        </div>
        <button 
            on:click={openLauncherWindow} 
            class="bg-[var(--accent-color)] text-white px-4 py-2 rounded text-sm hover:opacity-80 transition-opacity"
        >
            一覧を開く
        </button>
    </div>
</div>

        <hr class="border-black/10 mb-6">

        <!-- 💥 タスク除外設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タスク一覧から除外されているファイル (現在のワークスペース)</div>
          {#if $workspacesStore[$currentWorkspaceIndex]?.task_exclude_paths && $workspacesStore[$currentWorkspaceIndex].task_exclude_paths.length > 0}task_exclude_paths.length > 0}
            <ul class="border border-black/20 rounded bg-black/5 max-h-40 overflow-y-auto p-2 space-y-1">
               {#each $workspacesStore[$currentWorkspaceIndex].task_exclude_paths as path}
                <li class="flex justify-between items-center text-sm p-1 hover:bg-black/10 rounded">
                  <span class="truncate opacity-80" title={path}>{path.split(/[/\\]/).pop()}</span>
                  <button class="text-red-400 hover:text-red-500 font-bold px-2" on:click={() => removeExcludePath(path)}>×</button>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="text-sm opacity-50 p-2 border border-black/20 rounded bg-black/5">除外されているファイルはありません</div>
          {/if}
        </div>

        <!-- 💥 タスク除外見出し設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タスク一覧から除外されている見出し (現在のワークスペース)</div>
          {#if $workspacesStore[$currentWorkspaceIndex]?.task_exclude_headings && $workspacesStore[$currentWorkspaceIndex].task_exclude_headings.length > 0}
            <ul class="border border-black/20 rounded bg-black/5 max-h-40 overflow-y-auto p-2 space-y-1">
              {#each $workspacesStore[$currentWorkspaceIndex].task_exclude_headings as heading}
                <li class="flex justify-between items-center text-sm p-1 hover:bg-black/10 rounded">
                  <span class="truncate opacity-80" title={heading}>{heading}</span>
                  <button class="text-red-400 hover:text-red-500 font-bold px-2" on:click={() => removeExcludeHeading(heading)}>×</button>
                </li>
              {/each}
            </ul>
          {:else}
            <div class="text-sm opacity-50 p-2 border border-black/20 rounded bg-black/5">除外されている見出しはありません</div>
          {/if}
        </div>

        <hr class="border-black/10 mb-6">
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">タグの管理</div>
          <div class="flex gap-2 mb-4">
            <input type="text" class="flex-1 bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" bind:value={newTagInput} placeholder="新しいタグ名を入力" on:keydown={(e) => e.key === 'Enter' && addTag()} />
            <button class="px-4 py-2 bg-black/20 hover:bg-black/30 rounded text-sm transition" on:click={addTag}>登録</button>
          </div>
          <div class="flex gap-2">
            <select class="flex-1 border border-black/20 rounded p-2 text-sm outline-none" style="background-color: var(--bg-color); color: var(--text-color);" bind:value={selectedTagToRemove}>
              <option value="" disabled selected>登録済みのタグ一覧</option>
              {#each $registeredTags as tag}<option value={tag}>{tag}</option>{/each}
            </select>
            <button class="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-100 rounded text-sm transition" on:click={removeTag}>削除</button>
          </div>
        </div>

      {:else if activeSettingsTab === 'theme'}
        <ThemeSettings bind:tempTheme={tempTheme} />

      <!-- スタイルタブのコンテンツ -->
      {:else if activeSettingsTab === 'style'}
        <StyleSettings bind:tempStyle={tempStyle} bind:tempCustomSlots={tempCustomSlots} {defaultStyle} />
      {/if}

    </div>
  </div>
</div>
<!-- --- END OF src/components/SettingsModal.svelte --- -->