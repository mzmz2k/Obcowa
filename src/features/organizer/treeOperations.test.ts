import { describe, it, expect } from 'vitest';
import { moveNode } from './treeOperations';

describe('treeOperations - moveNode', () => {
  it('ショートカットモード: 元の場所を残して追加されること', () => {
    const fileNode = { type: 'File', name: 'test.md', path: 'test.md' };
    const dropFolder = { type: 'Folder', name: 'Organizer', children: [] };
    const sourceFolder = { type: 'Folder', name: 'Source', children: [fileNode] };
    const tree = [sourceFolder, dropFolder];

    const newTree = moveNode(tree, fileNode, dropFolder, false); // isFilterMode = false

    expect(newTree[0].children.length).toBe(1); // Sourceに残る
    expect(newTree[1].children.length).toBe(1); // Organizerにも追加
    expect(newTree[1].children[0].is_manual).toBe(true);
  });

  it('フィルタモード: 元の場所から消えて追加されること', () => {
    const fileNode = { type: 'File', name: 'test.md', path: 'test.md' };
    const dropFolder = { type: 'Folder', name: 'Organizer', children: [] };
    const sourceFolder = { type: 'Folder', name: 'Source', children: [fileNode] };
    const tree = [sourceFolder, dropFolder];

    const newTree = moveNode(tree, fileNode, dropFolder, true); // isFilterMode = true

    expect(newTree[0].children.length).toBe(0); // Sourceから消える
    expect(newTree[1].children.length).toBe(1); // Organizerに追加
  });
});