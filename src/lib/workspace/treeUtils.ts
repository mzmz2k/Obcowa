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
 * ワークスペースのノード群から、「ファイル名(小文字・拡張子なし) → ノードの配列」の辞書を作成します。
 * 将来の Wikiリンク や 引用(![[...]]) の解決を O(1) で高速に行うためのインデックスです。
 */
export function buildFilenameIndex(nodes: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    
    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File') {
                const name = node.name || node.title || node.path?.split(/[/\\]/).pop() || '';
                const dotIndex = name.lastIndexOf('.');
                const baseName = dotIndex !== -1 ? name.substring(0, dotIndex) : name;
                const key = baseName.trim().toLowerCase();

                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(node);
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return map;
}

/**
 * JS側で完結する高速なファイル名部分一致検索。
 * Rustに巨大なJSONを送らずに、検索タブ用の結果配列を生成します。
 */
export function searchFilesByName(nodes: any[], query: string): any[] {
    const results: any[] = [];
    const queryLower = query.trim().toLowerCase();
    if (!queryLower) return results;

    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File') {
                const name = node.name || node.title || node.path?.split(/[/\\]/).pop() || '';
                if (name.toLowerCase().includes(queryLower)) {
                    results.push({ path: node.path || node.original_path, name, snippet: "(ファイル名に一致)" });
                }
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return results;
}

/**
 * ノードツリーからファイルのパスのみを抽出し、フラットな文字列配列を生成します。
 * 巨大なツリーオブジェクト全体をRustへ送るIPC通信のオーバーヘッドを削減するために使用します。
 */
export function extractFilePaths(nodes: any[]): string[] {
    const paths = new Set<string>(); // 重複排除のためにSetを使用
    
    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            if (node.type === 'File' && (node.path || node.original_path)) {
                paths.add(node.path || node.original_path);
            } else if (node.type === 'Folder' && node.children) {
                traverse(node.children);
            }
        }
    }
    
    traverse(nodes);
    return Array.from(paths);
}