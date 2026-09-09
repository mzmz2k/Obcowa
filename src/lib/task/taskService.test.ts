// taskServiceの単体テスト

import { describe, it, expect, vi } from 'vitest';
import { fetchWorkspaceTasks, completeTaskStatus, buildTaskTree, sortTaskTreeNodes, type Task } from './taskService';

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
    
    describe('buildTaskTree', () => {
        const mockTasks: Task[] = [
            { filePath: '/fileA.md', lineNumber: 1, text: 'Task 1', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileB.md', lineNumber: 2, text: 'Task 2', originalText: '', headings: ['H1', 'H2'] },
            { filePath: '/fileA.md', lineNumber: 3, text: 'Task 3', originalText: '', headings: [] },
        ];

        it('ファイル単位で正しくグループ化されること', () => {

            const nodes = buildTaskTree(mockTasks, 'file', false);
            expect(nodes.length).toBe(2);
            
            const fileANode = nodes.find(n => n.id === 'file::/fileA.md');
            expect(fileANode?.tasks.length).toBe(2);
            expect(fileANode?.children.length).toBe(0);

        });

        it('見出し単位で階層化され、マージされること', () => {
            const nodes = buildTaskTree(mockTasks, 'heading', false);
            expect(nodes.length).toBe(2); // "見出しなし" と "H1"
            
            const noHeadingNode = nodes.find(n => n.id === 'heading::__no_heading__');
            expect(noHeadingNode?.tasks.length).toBe(1);
            
            const h1Node = nodes.find(n => n.name === 'H1');
            expect(h1Node?.children.length).toBe(1); // H2
            
            const h2Node = h1Node?.children[0];
            expect(h2Node?.name).toBe('H2');
            expect(h2Node?.tasks.length).toBe(2); // Task 1 (fileA), Task 2 (fileB)

        });

        it('H1を無視する設定が機能すること', () => {
            const nodes = buildTaskTree(mockTasks, 'heading', true);
            
            const h2Node = nodes.find(n => n.name === 'H2');
            expect(h2Node).toBeDefined(); // H1が除去され、H2がルートにきている
            expect(h2Node?.tasks.length).toBe(2);
        });
    });
});

describe('Task Sorting and Nesting', () => {
    it('ソート時、子タスクが親タスクに追従して正しくフラット化されること', () => {
        const mockTasks: Task[] = [
            { text: 'B 親タスク', indentLevel: 0, fileCreated: 1, headings: [], filePath: '', lineNumber: 1, originalText: '' },
            { text: 'Bの子タスク', indentLevel: 4, fileCreated: 1, headings: [], filePath: '', lineNumber: 2, originalText: '' },
            { text: 'A 親タスク', indentLevel: 0, fileCreated: 2, headings: [], filePath: '', lineNumber: 3, originalText: '' },
        ];

        const mockTreeNodes = [{ id: 'group1', tasks: mockTasks, children: [] }];

        // 文言順（text）でソート（A -> B の順になるはず）
        const result = sortTaskTreeNodes(mockTreeNodes, 'text');
        const sortedTasks = result[0].tasks;

        expect(sortedTasks[0].text).toBe('A 親タスク');
        expect(sortedTasks[1].text).toBe('B 親タスク');
        expect(sortedTasks[2].text).toBe('Bの子タスク'); // Bの子がBのすぐ後ろに追従している
    });
});