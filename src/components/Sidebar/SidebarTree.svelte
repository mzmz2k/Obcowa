<!-- サイドバーのツリー表示とピン留め -->

<script lang="ts">
  import TreeNode from '../TreeNode.svelte';
  import { Pin, X, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-svelte';
  import { workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import { unpinNodeFromWorkspace, requestSaveWorkspaces } from '../../lib/workspace/workspaceManager';
  import { getPinnedNode, getSortedNodes, groupNodesByCategory } from '../../lib/workspace/treeUtils';
  import ContextMenu from '../../features/ContextMenu.svelte';




  // --- カテゴリの折りたたみ状態 ---
  let collapsedCategories: Record<string, boolean> = {};
  function toggleCategory(cat: string) {
    collapsedCategories[cat] = !collapsedCategories[cat];
  }

  // --- カテゴリの並び替え（コンテキストメニュー） ---
  let showCategoryMenu = false;
  let menuX = 0, menuY = 0;
  let categoryMenuItems: any[] = [];

  function handleCategoryContextMenu(e: MouseEvent, category: string) {
    e.preventDefault();
    if (category === '') return; // 「カテゴリなし」は移動不可
    
    const ws = $workspacesStore[$currentWorkspaceIndex];
    if (!ws) return;

    let order = ws.category_order || [];
    const { sortedCategories } = groupNodesByCategory(ws.nodes, order, ws.sort_by, ws.sort_order);
    const movableCategories = sortedCategories.filter(c => c !== '');
    const currentIndex = movableCategories.indexOf(category);

    categoryMenuItems = [
      { label: '上に移動', icon: ArrowUp, disabled: currentIndex <= 0, action: () => moveCategory(category, -1) },
      { label: '下に移動', icon: ArrowDown, disabled: currentIndex >= movableCategories.length - 1 || currentIndex === -1, action: () => moveCategory(category, 1) }
    ];

    showCategoryMenu = true;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  function moveCategory(category: string, direction: number) {
    workspacesStore.update(wsList => {
      const ws = wsList[$currentWorkspaceIndex];
      if (!ws) return wsList;

      let order = ws.category_order || [];
      const { sortedCategories } = groupNodesByCategory(ws.nodes, order, ws.sort_by, ws.sort_order);
      let movable = sortedCategories.filter(c => c !== '');

      const idx = movable.indexOf(category);
      if (idx !== -1) {
        const newIdx = idx + direction;
        if (newIdx >= 0 && newIdx < movable.length) {
          const temp = movable[idx];
          movable[idx] = movable[newIdx];
          movable[newIdx] = temp;
        }
      }
      ws.category_order = movable;
      return wsList;
    });
    requestSaveWorkspaces();
  }
</script>

<div class="flex-1 p-2 overflow-auto">

  <!-- ピン留めエリア -->
  {#if $workspacesStore[$currentWorkspaceIndex]?.pinned && $workspacesStore[$currentWorkspaceIndex].pinned.length > 0}
    <div class="mb-2 flex items-start gap-1">
      <div class="pt-1.5 pl-1 shrink-0 opacity-60" title="ピン留め">
        <Pin size={12} />
      </div>
      <div class="flex-1 min-w-0">
      {#each $workspacesStore[$currentWorkspaceIndex].pinned as pin}
        <div class="flex items-center justify-between group">
          <div class="flex-1 overflow-hidden">
            <!-- 💥 修正: isReadonlyではなくownerIdを渡すように修正 -->
            <TreeNode node={getPinnedNode(pin, $workspacesStore[$currentWorkspaceIndex])} ownerId={$workspacesStore[$currentWorkspaceIndex].id} />
          </div>
          <button on:click={() => unpinNodeFromWorkspace(pin.path)} class="flex items-center justify-center brightness-60 hover:text-[color-mix(in srgb, var(--accent-color) 80%, var(--text-color))] opacity-0 group-hover:opacity-100 p-1" title="ピン留め解除">
            <X size={12} />
          </button>
        </div>
      {/each}
      </div>
    </div>
    <hr class="border-dashed mb-2" style="border-color: color-mix(in srgb, var(--text-color) 20%, transparent);">
  {/if}

  <!-- ツリー本体（ワークスペース） -->
  <div>
    {#if $workspacesStore.length > 0 && $workspacesStore[$currentWorkspaceIndex]}
      {@const ws = $workspacesStore[$currentWorkspaceIndex]}
      {@const grouped = groupNodesByCategory(ws.nodes, ws.category_order, ws.sort_by, ws.sort_order)}
      
      {#each grouped.sortedCategories as category}
        
        <!-- カテゴリ見出し -->
        {#if category !== ''}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div 
            class="flex items-center p-1 mt-3 mb-1 text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer select-none transition-opacity"
            on:click={() => toggleCategory(category)}
            on:contextmenu={(e) => handleCategoryContextMenu(e, category)}
          >
            <span class="mr-1">{#if collapsedCategories[category]}<ChevronRight size={14} />{:else}<ChevronDown size={14} />{/if}</span>
            {category}
          </div>
        {/if}

        <!-- ノード本体 -->
        {#if !collapsedCategories[category]}
          {#each grouped.groups[category] as node}
            <TreeNode {node} ownerId={ws.id} />
          {/each}
        {/if}
      {/each}
    {/if}
  </div>

</div>
{#if showCategoryMenu}
  <ContextMenu x={menuX} y={menuY} items={categoryMenuItems} onClose={() => showCategoryMenu = false} />
{/if}