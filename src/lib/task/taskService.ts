// 責務: Tauriと通信し、タスクの取得および完了処理を行うAPIサービス

import { invoke } from '@tauri-apps/api/core';

export interface Task {
    filePath: string;
    lineNumber: number;
    text: string;
    originalText: string;
    headings: string[];
}

export type GroupByOption = 'file' | 'heading';

export interface TaskGroup {
    id: string;          // グループの一意なキー
    labelPath: string[]; // 表示用の階層パス (例: ["準備", "ToDo"] や ["/path/to/file.md"])
    tasks: Task[];
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
    try {
        const tasks = await invoke<Task[]>('get_workspace_tasks', { 
            nodes,
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
export function groupTasks(
    tasks: Task[],
    groupBy: GroupByOption,
    ignoreH1: boolean
): TaskGroup[] {
    const groupMap = new Map<string, TaskGroup>();

    for (const task of tasks) {
        let labelPath: string[] = [];
        let id = '';

        if (groupBy === 'file') {
            labelPath = [task.filePath];
            id = `file::${task.filePath}`;
        } else {
            let headings = task.headings || [];
            // ignoreH1が有効な場合、インデックス0（H1相当）を除去
            if (ignoreH1 && headings.length > 0) {
                headings = headings.slice(1);
            }
            // 空文字（階層が飛んだ場合など）を除外
            const validHeadings = headings.filter(h => h.trim().length > 0);

            if (validHeadings.length === 0) {
                labelPath = ['No Heading'];
                id = 'heading::__no_heading__';
            } else {
                labelPath = validHeadings;
                id = `heading::${validHeadings.join('::')}`;
            }
        }

        if (!groupMap.has(id)) {
            groupMap.set(id, { id, labelPath, tasks: [] });
        }
        groupMap.get(id)!.tasks.push(task);
    }

    return Array.from(groupMap.values());
}