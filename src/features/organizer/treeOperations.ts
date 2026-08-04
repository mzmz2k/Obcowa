/**
 * ワークスペースのツリー構造内でノードを移動させる純粋関数
 */

// 指定したノードをツリーから削除して新しいツリーを返す
export function removeNodeFromTree(nodes: any[], targetNode: any): any[] {
  return nodes.filter(n => n !== targetNode).map(n => {
    if (n.children) {
      return { ...n, children: removeNodeFromTree(n.children, targetNode) };
    }
    return n;
  });
}

// 指定したフォルダのchildrenにノードを追加して新しいツリーを返す
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

// 移動元から削除し、移動先へ追加する
export function moveNode(nodes: any[], dragNode: any, dropFolder: any): any[] {
  if (!dragNode || !dropFolder) return nodes;
  if (dragNode === dropFolder) return nodes;

  // 循環参照の防止（ドロップ先がドラッグしているノードの子孫である場合は移動不可）
  const isDescendant = (folder: any, target: any): boolean => {
    if (!folder.children) return false;
    if (folder.children.includes(target)) return true;
    return folder.children.some((c: any) => isDescendant(c, target));
  };
  if (isDescendant(dragNode, dropFolder)) return nodes;

  const withoutDragNode = removeNodeFromTree(nodes, dragNode);
  return addNodeToFolder(withoutDragNode, dropFolder, dragNode);
}