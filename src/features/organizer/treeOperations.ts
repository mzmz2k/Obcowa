// ワークスペースのツリー構造内でノードを移動させる純粋関数

export function removeNodeFromTree(nodes: any[], targetNode: any): any[] {
  return nodes.filter(n => n !== targetNode).map(n => {
    if (n.children) {
      return { ...n, children: removeNodeFromTree(n.children, targetNode) };
    }
    return n;
  });
}

export function addNodeToFolder(nodes: any[], targetFolder: any, nodeToAdd: any): any[] {
  return nodes.map(n => {
    if (n === targetFolder) {
      return { ...n, children: [...(n.children || []), nodeToAdd] };
    }
    if (n.children) {
      return { ...n, children: addNodeToFolder(n.children, targetFolder, nodeToAdd) };
    }
    return n;
  });
}

export function moveNode(nodes: any[], dragNode: any, dropFolder: any, isFilterMode: boolean): any[] {
  if (!dragNode || !dropFolder) return nodes;
  if (dragNode === dropFolder) return nodes;

  // 循環参照の防止
  const isDescendant = (folder: any, target: any): boolean => {
    if (!folder.children) return false;
    if (folder.children.includes(target)) return true;
    return folder.children.some((c: any) => isDescendant(c, target));
  };
  if (isDescendant(dragNode, dropFolder)) return nodes;

  // 移動対象のクローンを作成し、手動追加フラグを立てる
  const clonedNode = JSON.parse(JSON.stringify(dragNode));
  clonedNode.is_manual = true;

  let newNodes = nodes;
  // フィルタ仕様（元の場所から消す）の場合のみ、元のツリーから削除する
  if (isFilterMode) {
    newNodes = removeNodeFromTree(newNodes, dragNode);
  }

  // ドロップ先へ追加
  return addNodeToFolder(newNodes, dropFolder, clonedNode);
}

// ノードを特定のノードの前後に追加（兄弟として）
export function insertNodeAdjacent(nodes: any[], targetNode: any, nodeToAdd: any, position: 'before' | 'after'): any[] {
  let result: any[] = [];
  for (const n of nodes) {
    if (n === targetNode) {
      if (position === 'before') result.push(nodeToAdd);
      result.push(n);
      if (position === 'after') result.push(nodeToAdd);
    } else {
      if (n.children) {
        result.push({ ...n, children: insertNodeAdjacent(n.children, targetNode, nodeToAdd, position) });
      } else {
        result.push(n);
      }
    }
  }
  return result;
}

// ツリーの中から特定のノードの親フォルダを探す
export function findParentFolder(nodes: any[], targetNode: any): any {
  for (const n of nodes) {
    if (n.children && n.children.includes(targetNode)) {
      return n;
    }
    if (n.children) {
      const found = findParentFolder(n.children, targetNode);
      if (found) return found;
    }
  }
  return null;
}