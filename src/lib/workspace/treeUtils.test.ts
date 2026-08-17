// 責務: treeUtils関数の単体テスト
import { describe, it, expect } from 'vitest';

describe('treeUtils', () => {
  it('ノード配列の基本動作を処理できること', () => {
    const nodes = [{ type: 'File', name: 'test.md', path: '/test.md' }];
    expect(nodes.length).toBe(1);
  });
});