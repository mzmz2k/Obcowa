// 責務: Tauriと通信し、タスクの取得および完了処理を行うAPIサービス

import { invoke } from '@tauri-apps/api/core';
import { extractFilePaths } from '../workspace/treeUtils';

export interface Task {
    filePath: string;
    lineNumber: number;
    text: string;
    originalText: string;
    headings: string[];
}

export type GroupByOption = 'file' | 'heading';

export interface TaskTreeNode {
    id: string;
    name: string;        // 見出し名、またはファイル名
    path: string;        // ファイルパス（ファイル単位のグループ化時のみ使用）
     tasks: Task[];
    children: TaskTreeNode[]; // 子階層
}

// 将来のフィルタリング拡張用
export interface TaskScanOptions {
    excludePaths?: string[];
    includePaths?: string[];
}

/**
 * ワークスペース内の未完了タスクを取得する
 */
export async function fetchWorkspaceTasks(nodes: any[], options?: TaskScanOptions): Promise<Task[]> {
    // 巨大なツリーオブジェクトの送信をやめ、ファイルパスだけを抽出して送付する
    const filePaths = extractFilePaths(nodes);
    try {
        const tasks = await invoke<Task[]>('get_workspace_tasks', { 
            filePaths,
            options: options || null 
        });
        return tasks;
    } catch (error) {
        console.error("Failed to fetch tasks:", error);
        throw new Error("タスクの取得に失敗しました");
    }
}

/**
 * タスクを完了状態にする（対象行の安全な上書き）
 */
export async function completeTaskStatus(task: Task, completed: boolean = true) {
    try {
        await invoke('complete_task', {
            filePath: task.filePath,
            lineNumber: task.lineNumber,
            originalText: task.originalText,
            completed
        });
    } catch (error) {
        console.error("Failed to complete task:", error);
        throw new Error(`タスクの更新に失敗しました: ${error}`);
    }
}

/**
 * タスクのリストを、指定された条件（ファイル単位 / 見出し単位）でグループ化する純粋関数
 */
export function buildTaskTree(
    tasks: Task[],
    groupBy: GroupByOption,
    ignoreH1: boolean
): TaskTreeNode[] {
    const rootNodes: TaskTreeNode[] = [];

    if (groupBy === 'file') {
        const fileMap = new Map<string, TaskTreeNode>();
        for (const task of tasks) {
            if (!fileMap.has(task.filePath)) {
                const fileName = task.filePath.split(/[/\\]/).pop() || 'Unknown';
                const node: TaskTreeNode = { id: `file::${task.filePath}`, name: fileName, path: task.filePath, tasks: [], children: [] };
                fileMap.set(task.filePath, node);
                rootNodes.push(node);
            }
            fileMap.get(task.filePath)!.tasks.push(task);
        }
        return rootNodes;
    }
    
    // 見出しごとの場合
    const noHeadingNode: TaskTreeNode = { id: 'heading::__no_heading__', name: '見出しなし', path: '', tasks: [], children: [] };

    for (const task of tasks) {
        let headings = task.headings || [];
        if (ignoreH1 && headings.length > 0) {
            headings = headings.slice(1);
        }
        const validHeadings = headings.filter(h => h.trim().length > 0);

        if (validHeadings.length === 0) {
            noHeadingNode.tasks.push(task);
            continue;
        }

        let currentLevelNodes = rootNodes;
        let currentIdPath = 'heading';

        for (let i = 0; i < validHeadings.length; i++) {
            const h = validHeadings[i];
            currentIdPath += `::${h}`;
            
            let node = currentLevelNodes.find(n => n.name === h);
            if (!node) {
                node = { id: currentIdPath, name: h, path: '', tasks: [], children: [] };
                currentLevelNodes.push(node);

    }
              
            // 最後の見出し階層ならタスクを追加
            if (i === validHeadings.length - 1) {
                node.tasks.push(task);
            }
            
            currentLevelNodes = node.children;
        }
    }
        if (noHeadingNode.tasks.length > 0) {
        rootNodes.unshift(noHeadingNode); // 見出しなしを先頭に追加
        }

    return rootNodes;

}