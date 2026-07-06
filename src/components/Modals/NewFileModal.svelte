<!-- --- START OF src/components/Modals/NewFileModal.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { createEventDispatcher } from 'svelte';
  import { registeredTags } from '../../lib/stores';

  // 親(+page.svelte)から受け取るデータ
  export let isOpen = false;
  export let targetDir = '';

  const dispatch = createEventDispatcher();

  let newFileName = '新しいファイル.md';
  let selectedTagForNew = '';

  // 💥 モーダルが開かれた瞬間に、入力欄を初期化する
  $: if (isOpen) {
    newFileName = '新しいファイル.md';
    selectedTagForNew = '';
  }

  // ファイル名（拡張子の前）だけを選択状態にするアクション
  function selectBaseName(node: HTMLInputElement) {
    setTimeout(() => {
      node.focus();
      const idx = node.value.lastIndexOf('.');
      if (idx > 0) node.setSelectionRange(0, idx);
      else node.select();
    }, 10);
  }

  // ファイル作成の実行
  async function createNewFileConfirm() {
    if (!newFileName.trim()) return;
    try {
      await invoke('create_new_file', { dirPath: targetDir, fileName: newFileName, insertTag: selectedTagForNew });
      isOpen = false;
      dispatch('success'); // 親に「作成成功したよ！」と知らせる
    } catch (e) {
      alert("ファイル作成に失敗しました: " + e);
    }
  }
</script>

{#if isOpen}
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
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={createNewFileConfirm}>作成</button>
      </div>
    </div>
  </div>
{/if}
<!-- --- END OF src/components/Modals/NewFileModal.svelte --- -->