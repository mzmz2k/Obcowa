// ワークスペースのノードツリー最新化およびスマートフォルダ評価、ワークスペースのファイル一覧取得
import { invoke } from '@tauri-apps/api/core';

export async function refreshTree(nodes: any[], workspaceNodes: any[]): Promise<any[]> {
  const updatedNodes = [];
  for (let node of nodes) {
    if (node.type === 'Folder' && node.original_path) {
      if (node.smart_rules) {
        try {
          const children = await invoke('evaluate_smart_folder', { 
            rules: node.smart_rules, 
            workspaceNodes 
          });
          node.children = children as any[];
        } catch {}
      } else {
        try {
          let freshChildren: any[] = await invoke('read_directory', { path: node.original_path });
          const oldFolders = new Map();
          if (node.children) {
            for (const c of node.children) {
              if (c.type === 'Folder') oldFolders.set(c.original_path, c);
            }
          }
          for (let fresh of freshChildren) {
            if (fresh.type === 'Folder') {
              if (oldFolders.has(fresh.original_path)) {
                const old = oldFolders.get(fresh.original_path);
                fresh.name = old.name;
                fresh.children = old.children || [];
              } else {
                fresh.children = [];
              }
            }
          }
          node.children = await refreshTree(freshChildren, workspaceNodes);
        } catch (e) {}
      }
    }
    updatedNodes.push(node);
  }
  return updatedNodes;
}

// ワークスペースと関連ライブラリのノードをマージして取得する共通関数
export function getWorkspaceNodes(
    workspaces: any[],
    workspaceIndex: number,
    includeLibrary: boolean = true
): any[] {
    const currentWs = workspaces[workspaceIndex];
    if (!currentWs) return [];

    let targetNodes = [...(currentWs.nodes || [])];

    if (includeLibrary && currentWs.linked_libraries) {
        for (const libId of currentWs.linked_libraries) {
            const lib = workspaces.find((w: any) => w.id === libId);
            if (lib && lib.nodes) {
                targetNodes = targetNodes.concat(lib.nodes);
            }
        }
    }

    return targetNodes;
}

/**
 * 拡張子を除いたファイル名でノードを検索する
 */
export function findNodesByBaseName(nodes: any[], baseName: string): any[] {
    let results: any[] = [];
    for (const node of nodes) {
        if (node.type !== 'Folder' && node.name) {
            // 拡張子があれば除去して比較 (例: "test.md" -> "test")
            const dotIndex = node.name.lastIndexOf('.');
            const nodeBaseName = dotIndex !== -1 ? node.name.substring(0, dotIndex) : node.name;
            if (nodeBaseName === baseName) {
                results.push(node);
            }
        }
        // 子階層も再帰的に探索
        if (node.children) {
            results = results.concat(findNodesByBaseName(node.children, baseName));
        }
    }
    return results;
}