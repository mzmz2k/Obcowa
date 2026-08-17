// 責務: ワークスペースのノードツリー最新化およびスマートフォルダ評価を行う関数群
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