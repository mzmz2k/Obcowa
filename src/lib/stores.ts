import { writable, get } from 'svelte/store';

export interface TabData {
    id: string;      // タブごとのユニークなID
    path: string;    // ファイルの実際のパス
    title: string;
    content: string;
    isEditing: boolean;
    isDirty: boolean;
}

export const openTabs = writable<TabData[]>([]);
export const activeTabId = writable<string | null>(null);

export const workspaces = writable<any[]>([]);
export const currentWorkspace = writable<any | null>(null);
export const editorFont = writable<string>('sans-serif'); 

// 💥 追加: Rust側に検索対象を伝えるために現在のインデックスをストア化
export const currentWorkspaceIndex = writable<number>(0);

// 💥 追加: 検索用の特殊なタブを作成・表示する関数
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
            title: "🔍 検索",
            content: "",
            isEditing: false,
            isDirty: false
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
            isDirty: false
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
            isDirty: true 
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