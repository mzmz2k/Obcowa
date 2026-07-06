import { describe, it, expect } from 'vitest';
import { extractTags, updateTagsInContent } from './tagUtils';

describe('tagUtils - extractTags', () => {
  it('フロントマターがない場合は空配列を返す', () => {
    expect(extractTags('ただのテキストです')).toEqual([]);
  });

  it('リスト形式のタグを抽出できる', () => {
    const md = `---\ntags:\n  - Apple\n  - Banana\n---\n本文`;
    expect(extractTags(md)).toEqual(['Apple', 'Banana']);
  });

  it('インライン形式のタグを抽出できる', () => {
    const md = `---\ntags: [Apple, Banana]\n---\n本文`;
    expect(extractTags(md)).toEqual(['Apple', 'Banana']);
  });

  it('重複したタグは排除される', () => {
    const md = `---\ntags:\n  - Apple\n  - Apple\n---\n本文`;
    expect(extractTags(md)).toEqual(['Apple']);
  });
});

describe('tagUtils - updateTagsInContent', () => {
  it('フロントマターがないファイルにタグを追加できる', () => {
    const md = '本文のみ';
    const result = updateTagsInContent(md, 'Apple', true);
    expect(result).toBe(`---\ntags:\n  - Apple\n---\n\n本文のみ`);
  });

  it('既存のタグに新しいタグを追加できる', () => {
    const md = `---\ntags:\n  - Apple\n---\n本文`;
    const result = updateTagsInContent(md, 'Banana', true);
    expect(result).toContain('- Apple');
    expect(result).toContain('- Banana');
  });

  it('タグを削除できる（すべて消えたら tags 行ごと消える）', () => {
    const md = `---\ntags:\n  - Apple\n---\n本文`;
    const result = updateTagsInContent(md, 'Apple', false);
    expect(result).not.toContain('tags:');
    expect(result).not.toContain('- Apple');
  });

  it('インライン形式を自動でリスト形式に直して追加する', () => {
    const md = `---\ntags: [Apple]\n---\n本文`;
    const result = updateTagsInContent(md, 'Banana', true);
    expect(result).not.toContain('tags: [Apple]');
    expect(result).toContain('tags:');
    expect(result).toContain('- Apple');
    expect(result).toContain('- Banana');
  });
});