// 責務: ワークスペースデータの永続化（他ウィンドウとの競合マージと保存の直列化）
import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { workspacesStore, currentWorkspaceIndex } from '../stores';

// 保存処理を直列化するためのPromiseキュー
let saveQueue: Promise<void> = Promise.resolve();

/**
 * 現在のワークスペースの状態を安全に保存します。
 * 連続で呼び出されてもキューに入れられ、マージ処理を行いながら順番に保存されます。
 * @param forceOverwrite - trueの場合、マージせずに現在のローカル状態を全て強制上書きします。
 */
export function requestSaveWorkspaces(forceOverwrite = false): Promise<void> {
    saveQueue = saveQueue.then(async () => {
        try {
            // 保存実行時の最新のStore状態を取得
            const workspaces = get(workspacesStore);
            const currentIndex = get(currentWorkspaceIndex);

            if (forceOverwrite) {
                await invoke('save_workspaces', { workspaces });
                return;
            }

            // 最新の保存データを読み込み（他ウィンドウや別処理での変更を拾う）
            const latestWorkspaces: any[] = await invoke('load_workspaces');
            
            if (latestWorkspaces.length !== workspaces.length) {
                await invoke('save_workspaces', { workspaces });
                return;
            }

            if (latestWorkspaces.length > 0 && latestWorkspaces[currentIndex]) {
                // 現在開いているワークスペースの設定だけを最新化してマージ
                latestWorkspaces[currentIndex] = workspaces[currentIndex];
                await invoke('save_workspaces', { workspaces: latestWorkspaces });
            } else {
                await invoke('save_workspaces', { workspaces });
            }
        } catch (e) {
            console.error('Workspace save failed, falling back to force overwrite:', e);
            // エラー時はフェールセーフとして強制保存（データの完全喪失を防ぐ）
            const workspaces = get(workspacesStore);
            await invoke('save_workspaces', { workspaces });
        }
    }).catch(e => {
        console.error('Error in save queue:', e);
    });

    return saveQueue;
}



 // --- ワークスペース・ツリー操作のビジネスロジック ---

 export function getNodePath(node: any): string {
   return node.type === 'Folder' ? node.original_path : node.path;
 }

 export async function removeNodeFromWorkspace(targetNode: any, ownerId: string): Promise<void> {
   workspacesStore.update(wsList => {
     const wsIndex = wsList.findIndex(w => w.id === ownerId);
     if (wsIndex === -1) return wsList;

     function filterOutNode(nodes: any[]): any[] {
       return nodes.filter(n => n !== targetNode).map(n => {
         if (n.children) n.children = filterOutNode(n.children);
         return n;
       });
     }
     wsList[wsIndex].nodes = filterOutNode(wsList[wsIndex].nodes);
     return wsList;
   });
   await requestSaveWorkspaces(true);
 }

 export function pinNodeToWorkspace(targetNode: any): void {
   const path = getNodePath(targetNode);
   workspacesStore.update(wsList => {
     const ws = wsList[get(currentWorkspaceIndex)];
     if (!ws) return wsList;
     if (!ws.pinned) ws.pinned = [];
     if (!ws.pinned.find((p: any) => p.path === path)) {
       ws.pinned.push({ item_type: targetNode.type, name: targetNode.name, path });
     }
     return wsList;
   });
   requestSaveWorkspaces(true);
 }

 export function unpinNodeFromWorkspace(path: string): void {
   workspacesStore.update(wsList => {
     const ws = wsList[get(currentWorkspaceIndex)];
     if (ws && ws.pinned) {
       ws.pinned = ws.pinned.filter((p: any) => p.path !== path);
     }
     return wsList;
   });
   requestSaveWorkspaces(true);
 }

 export function isNodePinned(targetNode: any): boolean {
   const ws = get(workspacesStore)[get(currentWorkspaceIndex)];
   if (!ws || !ws.pinned) return false;
   return ws.pinned.some((p: any) => p.path === getNodePath(targetNode));
 }

 export function getWorkspaceClickBehavior(): boolean {
   return get(workspacesStore)[get(currentWorkspaceIndex)]?.open_in_new_tab || false;
 }

 export function getWorkspaceGlobalSort(): { by: string; order: string } {
   const ws = get(workspacesStore)[get(currentWorkspaceIndex)];
   return {
     by: ws?.sort_by || 'name',
     order: ws?.sort_order || 'asc'
   };
 }

 export function setWorkspaceNodeSort(node: any, by: string, order: string): void {
   workspacesStore.update(wsList => {
     node.sort_by = by;
     node.sort_order = order;
     return wsList;
   });
   requestSaveWorkspaces(true);
 }