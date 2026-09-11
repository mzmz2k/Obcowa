<!-- サイドバーのツリー表示とピン留め -->

<script lang="ts">
  import TreeNode from '../TreeNode.svelte';
  import { Pin, X } from 'lucide-svelte';


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

  <!-- ピン留めエリア -->
  {#if workspaces[currentIndex]?.pinned && workspaces[currentIndex].pinned.length > 0}
    <div class="mb-2 flex items-start gap-1">
      <div class="pt-1.5 pl-1 shrink-0 opacity-60" title="ピン留め">
        <Pin size={12} />
      </div>
      <div class="flex-1 min-w-0">
      {#each workspaces[currentIndex].pinned as pin}
        <div class="flex items-center justify-between group">
          <div class="flex-1 overflow-hidden">
            <!-- 💥 修正: isReadonlyではなくownerIdを渡すように修正 -->
            <TreeNode node={getPinnedNode(pin)} ownerId={workspaces[currentIndex].id} />
          </div>
          <button on:click={() => unpin(pin.path)} class="flex items-center justify-center brightness-60 hover:text-[color-mix(in srgb, var(--accent-color) 80%, var(--text-color))] opacity-0 group-hover:opacity-100 p-1" title="ピン留め解除">
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
    {#if workspaces.length > 0 && workspaces[currentIndex]}
      {#each getSortedNodes(workspaces[currentIndex].nodes, workspaces[currentIndex].sort_by, workspaces[currentIndex].sort_order) as node}
         <TreeNode {node} ownerId={workspaces[currentIndex].id} />
      {/each}
    {/if}
  </div>

</div>