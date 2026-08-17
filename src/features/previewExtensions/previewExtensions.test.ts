// 前後のコード明確化: src/features/previewExtensions/previewExtensions.test.ts

import { describe, it, expect } from 'vitest';
import { toggleTaskMarkdown } from './previewExtensions';

describe('previewExtensions - toggleTaskMarkdown', () => {
  it('0番目の未完了タスクを完了状態にトグルすること', () => {
    const input = '- [ ] Task 1\n- [ ] Task 2';
    const expected = '- [x] Task 1\n- [ ] Task 2';
    expect(toggleTaskMarkdown(input, 0)).toBe(expected);
  });

  it('1番目の完了タスクを未完了状態にトグルすること', () => {
    const input = '- [x] Task 1\n- [x] Task 2';
    const expected = '- [x] Task 1\n- [ ] Task 2';
    expect(toggleTaskMarkdown(input, 1)).toBe(expected);
  });

  it('ネストされた2番目（インデックス1）のタスクのみ正確にトグルされること', () => {
    const input = '- [ ] tst\n  - [ ] tes';
    const expected = '- [ ] tst\n  - [x] tes';
    expect(toggleTaskMarkdown(input, 1)).toBe(expected);
  });

  it('コードブロック内のタスクは無視されること', () => {
    const input = '```\n- [ ] Code Task\n```\n- [ ] Real Task';
    const expected = '```\n- [ ] Code Task\n```\n- [x] Real Task';
    expect(toggleTaskMarkdown(input, 0)).toBe(expected);
  });
});