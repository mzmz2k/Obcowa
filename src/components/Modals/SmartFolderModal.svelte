<!-- --- START OF src/components/Modals/SmartFolderModal.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let editingSmartNode: any = null; // nullなら新規作成、値があれば編集
  export let workspaceNodes: any[] = [];   // 抽出対象として使うためのツリーデータ

  const dispatch = createEventDispatcher();

  let sfName = '';
  let sfTarget = '';
  let sfTargetWorkspace = false;
  let sfMatch = 'AND';
  let sfKeep = true;
  let sfConds: any[] = [];

  let prevIsOpen = false;

  // ブロック内部での変数更新を分離し、Svelte標準の安全なリアクティビティパターンに変更
  $: if (isOpen) {
    if (!prevIsOpen) {
      initForm();
    }
    prevIsOpen = true;
  } else {
    prevIsOpen = false;
  }

  function initForm() {
    if (editingSmartNode) {
      sfName = editingSmartNode.name;
      sfTarget = editingSmartNode.smart_rules.target_dir;
      sfTargetWorkspace = editingSmartNode.smart_rules.target_workspace || false;
      sfMatch = editingSmartNode.smart_rules.match_type;
      sfKeep = editingSmartNode.smart_rules.keep_structure;
      
      sfConds = JSON.parse(JSON.stringify(editingSmartNode.smart_rules.conditions));
      sfConds.forEach((c: any) => {
        if (c.cond_type === 'Tag' && !c.match_mode) c.match_mode = 'contains';
      });
    } else {
      sfName = '';
      sfTarget = '';
      sfTargetWorkspace = false;
      sfMatch = 'AND';
      sfKeep = true;
      sfConds = [];
    }
  }

  function changeCondType(idx: number, type: string) {
    if (type === 'Tag') sfConds[idx] = { cond_type: 'Tag', tag: '', match_mode: 'contains', include_inline: false, is_exclude: false };
    else sfConds[idx] = { cond_type: 'Date', date_type: 'updated', limit: 10 };
  }
//  Svelteが確実に変化に気付けるように、新しい配列を作って上書き(代入)する
  function addCondition() {
    if (sfConds.length < 5) {
      sfConds = [...sfConds, { cond_type: 'Tag', tag: '', match_mode: 'contains', include_inline: false, is_exclude: false }];
    }
  }

  // 削除時も同様に、指定したインデックス以外の新しい配列を作る
  function removeCondition(idx: number) {
    sfConds = sfConds.filter((_, i) => i !== idx);
  }

  async function selectSfTarget() {
    const path = await openDialog({ directory: true });
    if (typeof path === 'string') sfTarget = path;
  }

  async function saveSmartFolder() {
    if (!sfName || (!sfTarget && !sfTargetWorkspace)) return alert("名前と、少なくとも１つの抽出元を指定してください");
    
    const rules = { target_dir: sfTarget, target_workspace: sfTargetWorkspace, match_type: sfMatch, conditions: sfConds, keep_structure: sfKeep };
    try {
      // 💥 API通信はこのファイル（子）の中で行う
      const children = await invoke('evaluate_smart_folder', { 
        rules, 
        workspaceNodes 
      });
      
      // 親に「抽出完了したから、このデータでツリーを更新して！」と投げる
      dispatch('save', { name: sfName, rules, children });
      isOpen = false;
    } catch (e) { 
      alert("抽出に失敗しました: " + e); 
    }
  }
</script>

{#if isOpen}

<div 
  class="fixed inset-0 z-50 flex items-center justify-center" 
  style="background-color: color-mix(in srgb, var(--text-color) 45%, transparent);"
>
    <div 
      class="p-6 rounded shadow-lg border w-[550px] max-h-[90vh] overflow-y-auto" 
      style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);"
    >

      <h2 class="text-lg font-bold mb-4">{editingSmartNode ? '条件を編集' : '条件で抽出'}</h2>
      
      <div class="mb-4 space-y-2">
        <input type="text" class="input-theme w-full p-2" bind:value={sfName} placeholder="リストに表示する名前" />
        <div class="flex gap-2">

          <input type="text" class="input-theme flex-1 p-2 opacity-70" value={sfTarget} readonly placeholder="抽出元のフォルダ" />
          <button on:click={selectSfTarget} class="btn-sub px-3">選択</button>

        </div>
        <label class="flex items-center text-sm cursor-pointer mt-2">
          <input type="checkbox" bind:checked={sfTargetWorkspace} class="mr-2 accent-[var(--accent-color)]"> このワークスペースから抽出する
        </label>
      </div>

      <div class="p-4 rounded border mb-4" style="background-color: color-mix(in srgb, var(--text-color) 4%, transparent); border-color: color-mix(in srgb, var(--text-color) 12%, transparent);">
        <div class="flex justify-between items-center mb-3">
          <select class="input-theme p-1" bind:value={sfMatch}>
            <option value="AND">すべての条件を満たす (AND)</option>
            <option value="OR">いずれかの条件を満たす (OR)</option>
          </select>
          <button class="btn-sub px-2 py-1" on:click={addCondition} disabled={sfConds.length >= 5}>＋ 条件を追加</button>
        </div>

        <div class="space-y-3">
          {#each sfConds as cond, i}

            <div class="flex flex-col gap-2 p-3 rounded border relative" style="background-color: color-mix(in srgb, var(--text-color) 4%, transparent); border-color: color-mix(in srgb, var(--text-color) 12%, transparent);">
             <button class="del-btn absolute top-2 right-2 text-xs" on:click={() => removeCondition(i)}>✕</button>
              <select class="input-theme w-48 p-1" value={cond.cond_type} on:change={(e) => changeCondType(i, e.target.value)}>
                <option value="Tag">タグ</option>
                <option value="Date">作成日 / 更新日</option>
              </select>

              {#if cond.cond_type === 'Tag'}
                <div class="flex items-center gap-2">
                  <input type="text" class="input-theme flex-1 p-1" bind:value={cond.tag} placeholder="タグ名 (例: memo)" />
                  <select class="input-theme w-24 p-1" bind:value={cond.match_mode}>
                    <option value="contains">部分一致</option>
                    <option value="exact">完全一致</option>
                    <option value="starts">前方一致</option>
                    <option value="ends">後方一致</option>
                  </select>
                  <select class="input-theme w-20 p-1" bind:value={cond.is_exclude}>
                    <option value={false}>がある</option><option value={true}>がない</option>
                  </select>
                </div>
                <label class="flex items-center text-xs opacity-70 cursor-pointer"><input type="checkbox" bind:checked={cond.include_inline} class="mr-2 accent-[var(--accent-color)]">本文中のタグも含める</label>
              {:else}
                <div class="flex items-center gap-2">
                  <select class="input-theme p-1" bind:value={cond.date_type}>
                    <option value="created">作成日</option><option value="updated">更新日</option>
                  </select>
                  <span class="text-sm">が新しいもの</span>
                  <input type="number" class="input-theme w-16 p-1" bind:value={cond.limit} min="1" max="100" />
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
        <button class="btn-sub px-4 py-2" on:click={() => isOpen = false}>キャンセル</button>
        <button class="px-4 py-2 rounded text-sm shadow transition hover:brightness-110" style="background-color: var(--accent-color); color: var(--text-color);" on:click={saveSmartFolder}>
          {editingSmartNode ? '保存して更新' : '抽出して追加'}
        </button>
      </div>
    </div>
  </div>
{/if}


<style>
  .input-theme {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid color-mix(in srgb, var(--text-color) 20%, transparent);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    outline: none;
  }

  .input-theme:focus {
    border-color: var(--accent-color);
  }

  .btn-sub {
    background-color: color-mix(in srgb, var(--text-color) 8%, transparent);
    color: var(--text-color);
    border: 1px solid color-mix(in srgb, var(--text-color) 15%, transparent);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    transition: background-color 0.15s ease;
  }

  .btn-sub:hover:not(:disabled) {
    background-color: var(--active-highlight-bg);
  }

  .btn-sub:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .del-btn {
    color: color-mix(in srgb, #ef4444 80%, var(--text-color));
    transition: color 0.15s ease, opacity 0.15s ease;
  }

  .del-btn:hover {
    color: #ef4444;
    opacity: 0.8;
  }
</style>
<!-- --- END OF src/components/Modals/SmartFolderModal.svelte --- -->