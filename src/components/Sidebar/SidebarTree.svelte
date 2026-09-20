<!-- サイドバーのツリー表示とピン留め -->

<script lang="ts">
  import TreeNode from '../TreeNode.svelte';
  import { Pin, X } from 'lucide-svelte';
  import { workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import { unpinNodeFromWorkspace } from '../../lib/workspace/workspaceManager';
  import { getPinnedNode, getSortedNodes } from '../../lib/workspace/treeUtils';

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
      {#each getSortedNodes($workspacesStore[$currentWorkspaceIndex].nodes, $workspacesStore[$currentWorkspaceIndex].sort_by, $workspacesStore[$currentWorkspaceIndex].sort_order) as node}
         <TreeNode {node} ownerId={$workspacesStore[$currentWorkspaceIndex].id} />
      {/each}
    {/if}
  </div>

</div>