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