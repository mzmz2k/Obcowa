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
// --- END OF src/lib/workspace/workspaceManager.ts ---