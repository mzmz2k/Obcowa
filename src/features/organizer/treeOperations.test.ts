import { describe, it, expect } from 'vitest';
import { moveNode } from './treeOperations';

describe('treeOperations - moveNode', () => {
  it('ノードが指定フォルダへ正しく移動できること', () => {
    const fileNode = { type: 'File', name: 'test.md' };
    const dropFolder = { type: 'Folder', name: 'Organizer', children: [] };
    const sourceFolder = { type: 'Folder', name: 'Source', children: [fileNode] };
    const tree = [sourceFolder, dropFolder];

    const newTree = moveNode(tree, fileNode, dropFolder);

    expect(newTree[0].children.length).toBe(0); // Sourceからは消える
    expect(newTree[1].children.length).toBe(1); // Organizerに追加される
    expect(newTree[1].children[0]).toBe(fileNode);
  });

  it('循環参照になる移動（親を子に入れる）は無視されること', () => {
    const childFolder = { type: 'Folder', name: 'Child', children: [] };
    const parentFolder = { type: 'Folder', name: 'Parent', children: [childFolder] };
    const tree = [parentFolder];

    const newTree = moveNode(tree, parentFolder, childFolder);
    
    // 構造が変わっていないことを確認
    expect(newTree).toEqual(tree);
  });
});