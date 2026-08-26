// taskServiceの単体テスト

import { describe, it, expect, vi } from 'vitest';
import { fetchWorkspaceTasks, completeTaskStatus, type Task } from './taskService';

// Tauri APIをモック化
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn((cmd: string, args: any) => {
        if (cmd === 'get_workspace_tasks') {
            return Promise.resolve([
                { filePath: '/dummy/path.md', lineNumber: 2, text: 'Test Task', originalText: '- [ ] Test Task' }
            ]);
        }
        if (cmd === 'complete_task') {
            if (args.lineNumber === 999) return Promise.reject('Line number out of bounds');
            return Promise.resolve();
        }
    })
}));

describe('taskService', () => {
    it('fetchWorkspaceTasksが正しくタスクを返すこと', async () => {
        const tasks = await fetchWorkspaceTasks('/dummy/workspace');
        expect(tasks.length).toBe(1);
        expect(tasks[0].text).toBe('Test Task');
    });

    it('将来の拡張オプションを渡してもエラーにならないこと', async () => {
        const tasks = await fetchWorkspaceTasks('/dummy/workspace', { excludePaths: ['/dummy/workspace/node_modules'] });
        expect(tasks.length).toBe(1);
    });

    it('completeTaskStatusが成功すること', async () => {
        const task: Task = { filePath: '/dummy/path.md', lineNumber: 2, text: 'Test Task', originalText: '- [ ] Test Task' };
        await expect(completeTaskStatus(task)).resolves.toBeUndefined();
    });

    it('completeTaskStatusがRustからのエラーをキャッチして例外を投げること', async () => {
        const task: Task = { filePath: '/dummy/path.md', lineNumber: 999, text: 'Error Task', originalText: '- [ ] Error Task' };
        await expect(completeTaskStatus(task)).rejects.toThrow(/タスクの更新に失敗しました/);
    });
});