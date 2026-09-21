// 責務: ワークスペースデータの永続化（他ウィンドウとの競合マージと保存の直列化）
import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
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
                await emit('workspaces-updated');
                return;
            }

            // 最新の保存データを読み込み（他ウィンドウや別処理での変更を拾う）
            const latestWorkspaces: any[] = await invoke('load_workspaces');
            
            const currentWs = workspaces[currentIndex];

            if (!currentWs) {
                await invoke('save_workspaces', { workspaces });
                await emit('workspaces-updated');
                return;
            }

            // 💥 IDを基準にして、現在開いているワークスペースのみを安全にマージ
            const targetIndex = latestWorkspaces.findIndex((w: any) => w.id === currentWs.id);
            if (targetIndex !== -1) {
                latestWorkspaces[targetIndex] = currentWs;
                await invoke('save_workspaces', { workspaces: latestWorkspaces });
            } else {
               // ディスク側に見当たらない場合は末尾に追加
                latestWorkspaces.push(currentWs);
                await invoke('save_workspaces', { workspaces: latestWorkspaces });
            }
            // 他の全ウィンドウに変更を通知
            await emit('workspaces-updated');
        } catch (e) {
            console.error('Workspace save failed, falling back to force overwrite:', e);
            // エラー時はフェールセーフとして強制保存（データの完全喪失を防ぐ）
            const workspaces = get(workspacesStore);
            await invoke('save_workspaces', { workspaces });
            await emit('workspaces-updated').catch(() => {});
        }
    }).catch(e => {
        console.error('Error in save queue:', e);
    });

    return saveQueue;
}

// --- ウィンドウ間でのリアルタイム同期リスナー ---
if (typeof window !== 'undefined') {
    listen('workspaces-updated', async () => {
        try {
            const latestWorkspaces: any[] = await invoke('load_workspaces');
            const currentList = get(workspacesStore);
            const currentIndex = get(currentWorkspaceIndex);
            const currentWs = currentList[currentIndex];

            // グローバルStoreを最新データに置き換え
            workspacesStore.set(latestWorkspaces);

            // 他ウィンドウでの追加/削除でインデックスがズレても、今開いているワークスペースを見失わないよう補正
            if (currentWs) {
                const newIndex = latestWorkspaces.findIndex((w: any) => w.id === currentWs.id);
                if (newIndex !== -1) {
                    currentWorkspaceIndex.set(newIndex);
                }
            }
        } catch (e) {
            console.error('Failed to sync workspaces from event:', e);
        }
    });
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

 /**
 * ノードにカテゴリを設定します。
 * ルート階層に存在しない下層ノードの場合は、自動的にルートへ複製（ショートカット追加）します。
 */
export function setNodeCategory(targetNode: any, newCategory: string) {
  workspacesStore.update(wsList => {
    // currentWorkspaceIndex はストアから get() で取得する必要があります
    // ファイル上部で import { get } from 'svelte/store'; と import { currentWorkspaceIndex } from '../stores'; されている前提です
    // もしされていなければ、ここで Svelte のストア購読ルールに則って処理します
    return wsList; // 一旦ダミーリターン（下で正式に書きます）
  });
}


/**
 * ノードにカテゴリを設定します。
 * ルート階層に存在しない下層ノードの場合は、自動的にルートへ複製（ショートカット追加）します。
 */
export function setWorkspaceNodeCategory(targetNode: any, newCategory: string) {
  workspacesStore.update(wsList => {
    const currentIndex = get(currentWorkspaceIndex);
    const ws = wsList[currentIndex];
    if (!ws) return wsList;

    const targetPath = targetNode.type === 'Folder' ? targetNode.original_path : targetNode.path;

    // ルートにすでに同じパスのノードがあるか探す
    const existingRootNode = ws.nodes.find((n: any) => 
      (n.type === 'Folder' ? n.original_path : n.path) === targetPath
    );

    if (existingRootNode) {
      // ルートに存在する場合はカテゴリを上書き
      existingRootNode.category = newCategory;
    } else {
      // 下層にある場合は、ルートに複製して追加
      // structuredClone を使って安全にディープコピー
      const newNode = structuredClone(targetNode);
      newNode.category = newCategory;
      ws.nodes.push(newNode);
    }
    return wsList;
  });
  requestSaveWorkspaces();
}