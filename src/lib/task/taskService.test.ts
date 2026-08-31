// taskServiceの単体テスト

import { describe, it, expect, vi } from 'vitest';
import { fetchWorkspaceTasks, completeTaskStatus, groupTasks, type Task } from './taskService';

// Tauri APIをモック化
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn((cmd: string, args: any) => {
        if (cmd === 'get_workspace_tasks') {
            return Promise.resolve([
                { 
                    filePath: '/dummy/path.md', 
                    lineNumber: 2, 
                    text: 'Test Task', 
                    originalText: '- [ ] Test Task',
                    headings: ['H1 Title', 'H2 Subtitle']
                }
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
        const task: Task = { filePath: '/dummy/path.md', lineNumber: 2, text: 'Test Task', originalText: '- [ ] Test Task', headings: [] };
        await expect(completeTaskStatus(task)).resolves.toBeUndefined();
    });

    it('completeTaskStatusがRustからのエラーをキャッチして例外を投げること', async () => {
        const task: Task = { filePath: '/dummy/path.md', lineNumber: 999, text: 'Error Task', originalText: '- [ ] Error Task', headings: [] };
        await expect(completeTaskStatus(task)).rejects.toThrow(/タスクの更新に失敗しました/);
    });
    
    describe('groupTasks', () => {
        const mockTasks: Task[] = [
            { filePath: '/fileA.md', lineNumber: 1, text: 'Task 1', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileB.md', lineNumber: 2, text: 'Task 2', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileA.md', lineNumber: 3, text: 'Task 3', originalText: '', headings: [] },
        ];

        it('ファイル単位で正しくグループ化されること', () => {
            const groups = groupTasks(mockTasks, 'file', false);
            expect(groups.length).toBe(2);
            
            const fileAGroup = groups.find(g => g.id === 'file::/fileA.md');
            expect(fileAGroup?.tasks.length).toBe(2); // Task 1, Task 3
            
            const fileBGroup = groups.find(g => g.id === 'file::/fileB.md');
            expect(fileBGroup?.tasks.length).toBe(1); // Task 2
        });

        it('見出し単位で別ファイルの同じ階層がマージされること', () => {
            const groups = groupTasks(mockTasks, 'heading', false);
            expect(groups.length).toBe(2);
            
            const headingGroup = groups.find(g => g.id === 'heading::H1::H2');
            expect(headingGroup?.labelPath).toEqual(['H1', 'H2']);
            expect(headingGroup?.tasks.length).toBe(2); // Task 1 (fileA), Task 2 (fileB)
            
            const noHeadingGroup = groups.find(g => g.id === 'heading::__no_heading__');
            expect(noHeadingGroup?.labelPath).toEqual(['No Heading']);
            expect(noHeadingGroup?.tasks.length).toBe(1); // Task 3
        });

        it('H1を無視する設定が機能すること', () => {
            const groups = groupTasks(mockTasks, 'heading', true);
            
            const headingGroup = groups.find(g => g.id === 'heading::H2');
            expect(headingGroup?.labelPath).toEqual(['H2']); // H1が除去されている
            expect(headingGroup?.tasks.length).toBe(2);
        });
    });
});