//Svelte Store（タブの状態、ワークスペース一覧などをグローバル管理）

import { writable, get } from 'svelte/store';

export interface TabData {
    id: string;      // タブごとのユニークなID
    path: string;    // ファイルの実際のパス
    title: string;
    content: string;
    isEditing: boolean;
    isDirty: boolean;
    lastModified?: number; // ファイルの最終更新日時
    isConflict?: boolean; // 競合発生中で保留しているかどうかのフラグ
}

export const workspacesStore = writable<any[]>([]);
export const openTabs = writable<TabData[]>([]);
export const activeTabId = writable<string | null>(null);

export const workspaces = writable<any[]>([]);
export const currentWorkspace = writable<any | null>(null);
export const editorFont = writable<string>('sans-serif'); 
export const currentWorkspaceIndex = writable<number>(0);

export const registeredTags = writable<string[]>([]);

// 検索タブの状態を保持するためのストア
export const searchState = writable({
    query: '',
    includeLibrary: false,
    searchByFilename: false, // 先ほど追加したファイル名検索フラグ
    results: [] as any[],
    hasSearched: false
});

// 左メニュー（ツリー）のフォルダを自動展開するためのリクエスト保持ストア
// （同じファイルを連続でダブルクリックしても反応するように、タイムスタンプを含めます）
export const expandTreeRequest = writable<{ path: string; timestamp: number } | null>(null);


// 💥 検索用の特殊なタブを作成・表示する関数
export function openSearchTab() {
    const newId = "search-tab";
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        // 既に検索タブがあればそれを表示
        if (resetTabs.some(t => t.id === newId)) return resetTabs;
        // なければ作成
        return [...resetTabs, {
            id: newId,
            path: "__SEARCH__", // 検索タブと識別するための特殊パス
            title: "検索",
            content: "",
            isEditing: false,
            isDirty: false,
            lastModified: 0 
        }];
    });
    activeTabId.set(newId);
}

 // 💥 タスク一覧用の特殊なタブを作成・表示する関数
 export function openTaskTab() {
     const newId = "task-tab";
     openTabs.update(tabs => {
         const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
         // 既にタスクタブがあればそれを表示
         if (resetTabs.some(t => t.id === newId)) return resetTabs;
         // なければ作成
         return [...resetTabs, {
             id: newId,
             path: "__TASK__", // タスクタブと識別するための特殊パス
             title: "タスク一覧",
             content: "",
             isEditing: false,
             isDirty: false,
             lastModified: 0 
         }];
     });
     activeTabId.set(newId);
 }

// 💥 タブを切り替えるときに、すべてのタブをビューモード（isEditing = false）に戻す
export function switchTab(tabId: string) {
    openTabs.update(tabs => tabs.map(t => ({ ...t, isEditing: false })));
    activeTabId.set(tabId);
}

// 左クリック：今のタブを上書き
export function openFileInCurrentTab(filePath: string, title: string, initialContent: string) {
    const tabs = get(openTabs);
    const currentId = get(activeTabId);
    
    // 全てをビューモードにリセットした配列を作る
    const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));

    if (currentId && resetTabs.length > 0) {
        openTabs.set(resetTabs.map(tab => 
            tab.id === currentId 
                ? { ...tab, path: filePath, title, content: initialContent, isDirty: false }
                : tab
        ));
    } else {
        openFileInNewTab(filePath, title, initialContent);
    }
}

// 右クリック：新しいタブ（同じファイルでも気にせず新規作成）
export function openFileInNewTab(filePath: string, title: string, initialContent: string) {
    const newId = "tab-" + Date.now() + Math.random();
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        return [...resetTabs, {
            id: newId,
            path: filePath,
            title,
            content: initialContent,
            isEditing: false,
            isDirty: false,
            lastModified: 0
        }];
    });
    activeTabId.set(newId);
}

export function createNewTab() {
    const newId = "new-" + Date.now();
    openTabs.update(tabs => {
        const resetTabs = tabs.map(t => ({ ...t, isEditing: false }));
        return [...resetTabs, { 
            id: newId, 
            path: "", 
            title: "無題のファイル", 
            content: "", 
            isEditing: true, 
            isDirty: true,
            lastModified: 0
        }];
    });
    activeTabId.set(newId);
}

export function closeTab(idToClose: string) {
    openTabs.update(tabs => {
        const filtered = tabs.filter(t => t.id !== idToClose);
        activeTabId.update(current => {
            if (current === idToClose) {
                return filtered.length > 0 ? filtered[filtered.length - 1].id : null;
            }
            return current;
        });
        return filtered;
    });
}

//  ランチャー（ワークスペース一覧）を起動時に開くかどうかの設定
export const showLauncherOnStartup = writable<boolean>(false);