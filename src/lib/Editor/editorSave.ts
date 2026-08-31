// エディタの保存処理、競合ダイアログハンドリングの純粋・抽象化ロジック

export interface SaveDependencies {
    saveFileContent: (path: string, content: string, lastModified: number, force: boolean) => Promise<number>;
    getModified: (path: string) => Promise<number>;
    readFileContentBytes: (path: string) => Promise<number[]>;
    confirmDialog: (message: string, options: { title: string; kind: 'warning' | 'info' }) => Promise<boolean>;
    saveDashboard?: (workspaceId: string, content: string) => Promise<void>;
}

export interface BaseTabData {
    id: string;
    path?: string;
    content: string;
    isDirty: boolean;
    lastModified?: number;
    isConflict?: boolean;
    isDashboard?: boolean;
    workspaceId?: string;
}

/**
 * 指定したタブの保存を実行し、必要に応じて競合解決ダイアログを表示する
 */
export async function saveTabWithConflictCheck<T extends BaseTabData>(
    targetTab: T,
    deps: SaveDependencies,
    updateTab: (updater: (tab: T) => T) => void,
    onDialogStateChange?: (showing: boolean) => void
): Promise<boolean> {
if (!targetTab.isDirty) {
        return true;
    }

    if (targetTab.isDashboard && targetTab.workspaceId) {
        if (!deps.saveDashboard) return false;
        try {
            await deps.saveDashboard(targetTab.workspaceId, targetTab.content);
            updateTab(t => ({
                ...t,
                isDirty: false,
                isConflict: false
            }));
            return true;
        } catch (e) {
            console.error("Failed to save dashboard", e);
            return false;
        }
    }

    // 既存のパスなしファイルのスキップ（ダッシュボードにはpathが無いので、分岐後に移動）
    if (!targetTab.path || targetTab.path === '__SEARCH__') {
        return true;
    }

    try {
        const newModified = await deps.saveFileContent(
            targetTab.path,
            targetTab.content,
            targetTab.lastModified || 0,
            false
        );
        updateTab(t => ({
            ...t,
            isDirty: false,
            lastModified: newModified,
            isConflict: false
        }));
        return true;
    } catch (e) {
        if (e === 'CONFLICT') {
            onDialogStateChange?.(true);
            const overwrite = await deps.confirmDialog(
                "このファイルは他のアプリによって外部で変更されています。\nこの編集内容で上書き保存しますか？",
                { title: "ファイルの競合", kind: "warning" }
            );

            if (overwrite) {
                try {
                    const newModified = await deps.saveFileContent(
                        targetTab.path,
                        targetTab.content,
                        targetTab.lastModified || 0,
                        true
                    );
                    updateTab(t => ({
                        ...t,
                        isDirty: false,
                        lastModified: newModified,
                        isConflict: false
                    }));
                    onDialogStateChange?.(false);
                    return true;
                } catch (err) {
                    onDialogStateChange?.(false);
                    return false;
                }
            } else {
                const reload = await deps.confirmDialog(
                    "この変更を破棄して最新の外部ファイルを読み込みますか？",
                    { title: "再読み込みの確認", kind: "info" }
                );

                if (reload) {
                    try {
                        const bytes = await deps.readFileContentBytes(targetTab.path);
                        let latestContent = "";
                        try {
                            latestContent = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
                        } catch {
                            latestContent = new TextDecoder('shift-jis').decode(new Uint8Array(bytes));
                        }
                        const newModified = await deps.getModified(targetTab.path);

                        updateTab(t => ({
                            ...t,
                            content: latestContent,
                            isDirty: false,
                            lastModified: newModified,
                            isConflict: false
                        }));
                    } catch (err) {}
                } else {
                    updateTab(t => ({ ...t, isConflict: true }));
                }
                onDialogStateChange?.(false);
                return false;
            }
        }
        return false;
    }
}