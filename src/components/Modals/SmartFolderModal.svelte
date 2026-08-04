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

  // 💥 モーダルが開かれた瞬間に、新規作成か編集かを判定して初期化する
// 💥 変更: 直前の「開いていたか」の状態を記憶する変数を追加
  let prevIsOpen = false;

  // 💥 変更: 「閉じていた(false)」状態から「開いた(true)」状態になった瞬間だけ初期化処理を走らせる
  $: {
    if (isOpen && !prevIsOpen) {
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
    // 状態を更新
    prevIsOpen = isOpen;
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
          <button class="text-sm px-2 py-1 bg-black/10 hover:bg-black/20 rounded transition" on:click={addCondition} disabled={sfConds.length >= 5}>＋ 条件を追加</button>
        </div>

        <div class="space-y-3">
          {#each sfConds as cond, i}
            <div class="flex flex-col gap-2 p-3 bg-black/5 border border-black/10 rounded relative">
             <button class="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs" on:click={() => removeCondition(i)}>✕</button>
              
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
        <button class="px-4 py-2 bg-black/10 hover:bg-black/20 rounded text-sm transition" on:click={() => isOpen = false}>キャンセル</button>
        <button class="px-4 py-2 bg-[var(--accent-color)] text-white hover:brightness-110 rounded text-sm shadow transition" on:click={saveSmartFolder}>{editingSmartNode ? '保存して更新' : '抽出して追加'}</button>
      </div>
    </div>
  </div>
{/if}
<!-- --- END OF src/components/Modals/SmartFolderModal.svelte --- -->