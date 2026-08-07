//サイドバーのツリー表示とピン留め

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

    // 見つからなければリンクされたライブラリの中も探す
    if (ws.linked_libraries) {
      for (const libId of ws.linked_libraries) {
        const lib = workspaces.find(w => w.id === libId);
        if (lib) {
          realNode = findNode(lib.nodes);
          if (realNode) return realNode;
        }
      }
    }
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
    <div class="mb-2">
      <div class="flex items-center text-xs font-bold opacity-60 mb-1 pl-1"><Pin size={12} class="mr-1" /> ピン留め</div>
      {#each workspaces[currentIndex].pinned as pin}
        <div class="flex items-center justify-between group">
          <div class="flex-1 overflow-hidden">
            <!-- 💥 修正: isReadonlyではなくownerIdを渡すように修正 -->
            <TreeNode node={getPinnedNode(pin)} ownerId={workspaces[currentIndex].id} isLibraryNode={false} />
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
         <TreeNode {node} ownerId={workspaces[currentIndex].id} isLibraryNode={false} />
      {/each}
    {/if}
  </div>

  <!-- 参照されているライブラリを一括表示 -->
  {#if workspaces[currentIndex]?.linked_libraries?.length > 0}
    {#each workspaces[currentIndex].linked_libraries as libId}
      {@const lib = workspaces.find(w => w.id === libId)}
      {#if lib}
        {#if lib.is_flat}
          {#each getSortedNodes(lib.nodes, lib.sort_by, lib.sort_order) as node}
            <TreeNode node={node} ownerId={lib.id} isLibraryNode={true} />
          {/each}
        {:else}
          <!-- ライブラリのガワ(is_virtual_wrapper)として保護する -->
          <TreeNode node={{ type: 'Folder', name: lib.name, original_path: null, children: lib.nodes, is_virtual_wrapper: true }} ownerId={lib.id} isLibraryNode={true} />
        {/if}
      {/if}
    {/each}
  {/if}
</div>