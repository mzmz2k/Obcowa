<!-- サイドバーのツリー表示とピン留め -->

<script lang="ts">
  import TreeNode from '../TreeNode.svelte';
  import { Pin, X, LayoutDashboard } from 'lucide-svelte';
  import { openDashboardTab } from '../../lib/stores'; 

  // 親から受け取るデータと関数
  export let workspaces: any[];
  export let currentIndex: number;
  export let unpin: (path: string) => void;

  // ピン留めされた簡単な情報から、ツリー上の「本物」のデータを探し出す関数
  function getPinnedNode(pin: any) {
    const ws = workspaces[currentIndex];
    if (!ws) return pin;

    // ツリーを再帰的に探す関数
    function findNode(nodes: any[]): any {
      for (const n of nodes) {
        const path = n.type === 'Folder' ? n.original_path : n.path;
        if (n.type === pin.item_type && n.name === pin.name && path === pin.path) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    }

    // まず現在のワークスペースから探す
    let realNode = findNode(ws.nodes);
    if (realNode) return realNode;

    // どこにもなければ、とりあえず空のダミーを作って返す
    return { type: pin.item_type, name: pin.name, path: pin.path, original_path: pin.path, children: [] };
  }

  // ソート用の並び替え関数
  function getSortedNodes(nodes: any[], sortBy = 'name', sortOrder = 'asc') {
    if (!nodes) return [];
    return [...nodes].sort((a, b) => {
      // フォルダは常に上に配置
      const isDirA = a.type === 'Folder';
      const isDirB = b.type === 'Folder';
      if (isDirA !== isDirB) return isDirA ? -1 : 1;
      
      let comp = 0;
      if (sortBy === 'created') comp = (a.created || 0) - (b.created || 0);
      else if (sortBy === 'modified') comp = (a.modified || 0) - (b.modified || 0);
      else comp = a.name.localeCompare(b.name);
      
      return sortOrder === 'asc' ? comp : -comp;
    });
  }
</script>

<div class="flex-1 p-2 overflow-auto">

  <!-- ---  ダッシュボードボタン --- -->
  {#if workspaces.length > 0 && workspaces[currentIndex]}
    <div class="mb-2">
      <button 
        on:click={() => openDashboardTab(workspaces[currentIndex].id, workspaces[currentIndex].name)}
        class="w-full flex items-center p-1.5 rounded hover:bg-[var(--active-highlight-bg)] text-[var(--text-color)] group transition-colors"
      >
        <LayoutDashboard size={16} class="mr-2 text-[var(--accent-color)]" />
        <span class="text-sm font-medium">ダッシュボード</span>
      </button>
    </div>
    <hr class="border-gray-700 border-dashed mb-2 opacity-30">
  {/if}

  <!-- ピン留めエリア -->
  {#if workspaces[currentIndex]?.pinned && workspaces[currentIndex].pinned.length > 0}
    <div class="mb-2">
      <div class="flex items-center text-xs font-bold opacity-60 mb-1 pl-1"><Pin size={12} class="mr-1" /> ピン留め</div>
      {#each workspaces[currentIndex].pinned as pin}
        <div class="flex items-center justify-between group">
          <div class="flex-1 overflow-hidden">
            <!-- 💥 修正: isReadonlyではなくownerIdを渡すように修正 -->
            <TreeNode node={getPinnedNode(pin)} ownerId={workspaces[currentIndex].id} />
          </div>
          <button on:click={() => unpin(pin.path)} class="flex items-center justify-center brightness-60 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1">
            <X size={12} />
          </button>
        </div>
      {/each}
    </div>
    <hr class="border-gray-700 border-dashed mb-2">
  {/if}

  <!-- ツリー本体（ワークスペース） -->
  <div>
    {#if workspaces.length > 0 && workspaces[currentIndex]}
      {#each getSortedNodes(workspaces[currentIndex].nodes, workspaces[currentIndex].sort_by, workspaces[currentIndex].sort_order) as node}
         <TreeNode {node} ownerId={workspaces[currentIndex].id} />
      {/each}
    {/if}
  </div>

</div>