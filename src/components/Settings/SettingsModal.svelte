<!-- --- START OF src/components/SettingsModal.svelte --- -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import StyleSettings from './StyleSettings.svelte';
  import { activeStyleSlot, customStyleSlots, defaultStyle, applyStyleToRoot } from '../../features/styleSettings/styleStore';
  import { activeTheme, type Theme } from '../../lib/settings/theme';
  import { editorFont, registeredTags, imageFolderPath } from '../../lib/stores';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';

  const dispatch = createEventDispatcher();

  export let workspaces: any[];
  export let currentIndex: number;

  let tempFont = $editorFont || 'sans-serif';
  let tempImageFolder = $imageFolderPath || '';
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

  // 画像フォルダの選択ダイアログ
  async function selectImageFolder() {
    const selectedPath = await openDialog({ directory: true, multiple: false });
    if (typeof selectedPath === 'string') {
      tempImageFolder = selectedPath;
    }
  }

  // 設定の保存と適用
  function saveSettings() {
    
    // 画像フォルダパスの保存
    $imageFolderPath = tempImageFolder;
    localStorage.setItem('imageFolderPath', tempImageFolder);

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
      workspaces[currentIndex].editor_font = tempStyle.editorFont; // 💥 変更: tempStyleから取得するよう修正
    }

    // 呼び出し元の +page.svelte に保存処理を依頼して閉じる
    dispatch('save');
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
          <div class="text-sm opacity-80 mb-2">添付ファイル（画像）の保存フォルダ</div>
          <div class="flex gap-2">
            <input type="text" class="flex-1 bg-black/5 border border-black/20 rounded p-2 text-sm opacity-70" value={tempImageFolder} readonly placeholder="指定しない（ファイルと同じ場所を探します）" />
            <button on:click={selectImageFolder} class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm border border-black/20 transition">選択</button>
            {#if tempImageFolder}
              <button on:click={() => tempImageFolder = ''} class="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-100 rounded text-sm transition">クリア</button>
            {/if}
          </div>
          <div class="text-xs opacity-50 mt-1">※Obsidian側で添付ファイルを特定のフォルダにまとめている場合は、ここを指定してください</div>
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