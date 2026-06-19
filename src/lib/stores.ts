import { writable } from 'svelte/store';

// タブのデータ構造
export interface TabData {
    id: string;        // ファイルパスをIDとして代用するのがおすすめ
    title: string;
    content: string;   // ファイルのテキストデータ
    isEditing: boolean;// 編集モードかプレビューモードか
    isDirty: boolean;  // 変更が保存されていないか
}

// 開いているすべてのタブ
export const openTabs = writable<TabData[]>([]);
// 現在アクティブなタブのID
export const activeTabId = writable<string | null>(null);

// ワークスペース一覧
export const workspaces = writable<any[]>([]);
export const currentWorkspace = writable<any | null>(null);

// 💡 提案：タブを開く処理を共通化し、既に開いていればアクティブにするだけに留める
export function openFileInTab(filePath: string, title: string, initialContent: string) {
    openTabs.update(tabs => {
        const existingTab = tabs.find(t => t.id === filePath);
        if (existingTab) {
            activeTabId.set(filePath);
            return tabs;
        }
        activeTabId.set(filePath);
        return [...tabs, { 
            id: filePath, 
            title, 
            content: initialContent, 
            isEditing: false, 
            isDirty: false 
        }];
    });
}