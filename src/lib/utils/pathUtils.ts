// アプリ内の特殊なパス（仮想タブ）の判定を共通化する

/**
 * 通常のファイルではなく、アプリの特殊な仮想タブ（検索、タスク、ダッシュボード等）かどうかを判定する
 */
export function isSpecialPath(path: string | undefined | null): boolean {
    if (!path) return false; // パスなし（新規作成の未保存ファイル）は特殊タブではない
    
    return path === '__SEARCH__' || 
           path === '__TASK__' || 
           path.startsWith('__DASHBOARD__');
}

/**
 * ダッシュボードのパスかどうかを判定する
 */
export function isDashboardPath(path: string | undefined | null): boolean {
    if (!path) return false;
    return path.startsWith('__DASHBOARD__');
}

/**
 * ダッシュボードのパスからワークスペースIDを抽出する
 */
export function getWorkspaceIdFromDashboardPath(path: string | undefined | null): string | null {
    if (!path || !path.startsWith('__DASHBOARD__')) return null;
    return path.replace('__DASHBOARD__', '');
}