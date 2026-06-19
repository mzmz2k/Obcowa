import { writable, get } from 'svelte/store';

export interface TabData {
    id: string;
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


// 🔽 今回追加した部分 🔽
export function createNewTab() {
    openTabs.update(tabs => {
        const id = "new-" + Date.now();
        const newTab = { 
            id, 
            title: "無題のファイル", 
            content: "", 
            isEditing: true, 
            isDirty: true 
        };
        activeTabId.set(id);
        return [...tabs, newTab];
    });
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

// 左クリック用：今のタブを上書きして開く
export function openFileInCurrentTab(filePath: string, title: string, initialContent: string) {
    const tabs = get(openTabs);
    const currentId = get(activeTabId);
    
    // すでに同じファイルがどこかのタブで開かれていたら、そこに移動するだけ
    if (tabs.find(t => t.id === filePath)) {
        activeTabId.set(filePath);
        return;
    }

    if (currentId && tabs.length > 0) {
        // 現在のタブを上書き
        openTabs.update(t => t.map(tab => 
            tab.id === currentId 
                ? { id: filePath, title, content: initialContent, isEditing: false, isDirty: false }
                : tab
        ));
        activeTabId.set(filePath);
    } else {
        // タブが1つもない場合は新規に開く
        openFileInNewTab(filePath, title, initialContent);
    }
}

// 右クリック用：新しいタブとして開く
export function openFileInNewTab(filePath: string, title: string, initialContent: string) {
    const tabs = get(openTabs);
    if (tabs.find(t => t.id === filePath)) {
        activeTabId.set(filePath);
        return;
    }
    
    openTabs.update(t => [...t, {
        id: filePath,
        title,
        content: initialContent,
        isEditing: false,
        isDirty: false
    }]);
    activeTabId.set(filePath);
}