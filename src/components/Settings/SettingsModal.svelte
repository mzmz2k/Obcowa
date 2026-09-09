<!-- --- START OF src/components/SettingsModal.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import StyleSettings from './StyleSettings.svelte';
  import { activeStyleSlot, customStyleSlots, defaultStyle, applyStyleToRoot } from '../../features/styleSettings/styleStore';
  import { activeTheme, type Theme } from '../../lib/settings/theme';
  import { editorFont, registeredTags } from '../../lib/stores';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';

  import { showLauncherOnStartup } from '../../lib/stores';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher();

  export let workspaces: any[];
  export let currentIndex: number;

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
    if (workspaces[currentIndex] && workspaces[currentIndex].task_exclude_paths) {
      workspaces[currentIndex].task_exclude_paths = workspaces[currentIndex].task_exclude_paths.filter((p: string) => p !== pathToRemove);
      workspaces = workspaces; // Svelteに配列の変更を検知させる
    }
  }

  // タスク除外見出しの解除処理
  function removeExcludeHeading(headingToRemove: string) {
    if (workspaces[currentIndex] && workspaces[currentIndex].task_exclude_headings) {
      workspaces[currentIndex].task_exclude_headings = workspaces[currentIndex].task_exclude_headings.filter((h: string) => h !== headingToRemove);
      workspaces = workspaces; // Svelteに配列の変更を検知させる
    }
  }



  // 画像フォルダの選択ダイアログ
  async function selectImageFolder() {
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      if (!workspaces[currentIndex].image_folders) workspaces[currentIndex].image_folders = [];
      if (!workspaces[currentIndex].image_folders.includes(selectedPath)) {
        workspaces[currentIndex].image_folders = [...workspaces[currentIndex].image_folders, selectedPath];
      }
    }
  }

  // 画像フォルダの削除
  function removeImageFolder(folder: string) {
    if (workspaces[currentIndex] && workspaces[currentIndex].image_folders) {
      workspaces[currentIndex].image_folders = workspaces[currentIndex].image_folders.filter((f: string) => f !== folder);
      workspaces = workspaces; // Svelteに配列の変更を検知させる
    }
  }


  // 設定の保存と適用
  function saveSettings() {

    // テーマの保存
    $activeTheme = { ...tempTheme };
    localStorage.setItem('activeTheme', JSON.stringify($activeTheme));

    // スタイルの保存と適用
    $activeStyleSlot = tempStyle;
    $customStyleSlots = tempCustomSlots;
    localStorage.setItem('activeStyle', JSON.stringify(tempStyle));
    localStorage.setItem('customStyleSlots', JSON.stringify(tempCustomSlots));
    applyStyleToRoot(tempStyle);

    if (workspaces[currentIndex]) {
      workspaces[currentIndex].editor_font = tempStyle.editorFont; // 💥 変更: tempStyleから取得するよう修正
    }

    if (workspaces[currentIndex]) {
      workspaces[currentIndex].editor_font = tempStyle.editorFont; // tempStyleから取得するよう修正
    }

    // 呼び出し元の +page.svelte に保存処理を依頼して閉じる
    dispatch('save');
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

</script>

<div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
  <div class="rounded shadow-xl border border-black/20 flex overflow-hidden w-[700px] h-[550px]" style="background-color: var(--menu-bg); color: var(--text-color);">
    
    <!-- 左サイドバー（タブ） -->
    <div class="w-1/4 bg-black/10 p-4 space-y-2 text-sm border-r border-black/10">
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'general' ? 'bg-[var(--accent-color)] text-white font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'general'}>一般</button>
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'theme' ? 'bg-[var(--accent-color)] text-white font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'theme'}>テーマ</button>
       <!-- スタイルタブのボタン -->
      <button class="w-full text-left p-2 rounded transition-colors {activeSettingsTab === 'style' ? 'bg-[var(--accent-color)] text-white font-bold' : 'hover:bg-black/10'}" on:click={() => activeSettingsTab = 'style'}>スタイル</button>
    </div>

    <!-- 右コンテンツ -->
    <div class="w-3/4 p-6 overflow-y-auto flex flex-col relative">
      
      {#if activeSettingsTab === 'general'}
        <h2 class="text-lg font-bold mb-6">一般設定</h2>
      
        <!-- 画像フォルダの設定エリア -->
        <div class="mb-6">
          <div class="text-sm opacity-80 mb-2">添付ファイル（画像）の保存フォルダ (複数指定可)</div>
          <ul class="mb-2 space-y-1">
            {#each workspaces[currentIndex]?.image_folders || [] as folder}
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
          {#if workspaces[currentIndex]?.task_exclude_paths && workspaces[currentIndex].task_exclude_paths.length > 0}
            <ul class="border border-black/20 rounded bg-black/5 max-h-40 overflow-y-auto p-2 space-y-1">
              {#each workspaces[currentIndex].task_exclude_paths as path}
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
          {#if workspaces[currentIndex]?.task_exclude_headings && workspaces[currentIndex].task_exclude_headings.length > 0}
            <ul class="border border-black/20 rounded bg-black/5 max-h-40 overflow-y-auto p-2 space-y-1">
              {#each workspaces[currentIndex].task_exclude_headings as heading}
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

      <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-black/10">
        <button class="px-5 py-2 bg-black/20 hover:bg-black/30 rounded text-sm transition font-bold" on:click={() => dispatch('close')}>キャンセル</button>
        <button class="px-5 py-2 bg-[var(--accent-color)] text-white rounded text-sm transition font-bold shadow hover:brightness-110" on:click={saveSettings}>設定を保存して閉じる</button>
      </div>
    </div>
  </div>
</div>
<!-- --- END OF src/components/SettingsModal.svelte --- -->