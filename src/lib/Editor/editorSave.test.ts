// editorSave関数の単体テスト
import { describe, it, expect, vi } from 'vitest';
import { saveTabWithConflictCheck, type SaveDependencies, type TabData } from './editorSave';

describe('editorSave', () => {
    it('isDirtyがfalseの場合は保存処理を行わない', async () => {
        const mockSave = vi.fn();
        const deps: SaveDependencies = {
            saveFileContent: mockSave,
            getModified: vi.fn(),
            readFileContentBytes: vi.fn(),
            confirmDialog: vi.fn(),
        };

        const tab: TabData = { id: '1', path: '/test.md', content: 'hello', isDirty: false };
        const result = await saveTabWithConflictCheck(tab, deps, vi.fn());

        expect(result).toBe(true);
        expect(mockSave).not.toHaveBeenCalled();
    });

    it('正常保存時にisDirtyがクリアされ更新日時がセットされる', async () => {
        const deps: SaveDependencies = {
            saveFileContent: vi.fn().mockResolvedValue(1000),
            getModified: vi.fn(),
            readFileContentBytes: vi.fn(),
            confirmDialog: vi.fn(),
        };

        const tab: TabData = { id: '1', path: '/test.md', content: 'hello', isDirty: true, lastModified: 500 };
        let updatedTab: TabData = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(true);
        expect(updatedTab.isDirty).toBe(false);
        expect(updatedTab.lastModified).toBe(1000);
    });

    it('CONFLICT時にユーザーが上書きを選択した場合、force=trueで再保存する', async () => {
        const saveFileContentMock = vi.fn()
            .mockRejectedValueOnce('CONFLICT')
            .mockResolvedValueOnce(2000);

        const deps: SaveDependencies = {
            saveFileContent: saveFileContentMock,
            getModified: vi.fn(),
            readFileContentBytes: vi.fn(),
            confirmDialog: vi.fn().mockResolvedValue(true),
        };

        const tab: TabData = { id: '1', path: '/test.md', content: 'hello', isDirty: true };
        let updatedTab: TabData = { ...tab };

        const result = await saveTabWithConflictCheck(tab, deps, (updater) => {
            updatedTab = updater(updatedTab);
        });

        expect(result).toBe(true);
        expect(saveFileContentMock).toHaveBeenNthCalledWith(1, '/test.md', 'hello', 0, false);
        expect(saveFileContentMock).toHaveBeenNthCalledWith(2, '/test.md', 'hello', 0, true);
        expect(updatedTab.isDirty).toBe(false);
        expect(updatedTab.lastModified).toBe(2000);
    });
});