// --- START OF src/lib/library.test.ts ---
import { expect, test } from 'vitest';
import { cloneNodeAsIndependent } from './library';

test('ノードを完全に独立したデータとしてコピーできるか', () => {
    const original = {
        type: 'Folder', name: 'MyFolder',
        children: [{ type: 'File', name: 'memo.md' }],
        smart_rules: { match_type: 'AND', conditions: [] }
    };

    const copied = cloneNodeAsIndependent(original);

    // 1. 中身がまったく同じ形になっているか
    expect(copied).toEqual(original);

    // 2. メモリの参照が別になっているか（独立しているか）
    expect(copied).not.toBe(original);
    expect(copied.children).not.toBe(original.children);

    // 3. コピー元を変更しても、コピー先に影響しないか
    original.name = 'Renamed';
    original.children[0].name = 'changed.md';
    expect(copied.name).toBe('MyFolder'); // 影響を受けていない！
    expect(copied.children[0].name).toBe('memo.md');
});
// --- END OF src/lib/library.test.ts ---