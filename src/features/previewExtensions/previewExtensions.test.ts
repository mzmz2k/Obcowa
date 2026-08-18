// 前後のコード明確化: src/features/previewExtensions/previewExtensions.test.ts

import { describe, it, expect } from 'vitest';
import { toggleTaskMarkdown, toggleHeadingCollapse } from './previewExtensions';

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

describe('previewExtensions - toggleHeadingCollapse', () => {
  it('H2が折りたたまれた状態でH1を閉じ→開いた時、H2配下の非表示状態が維持されること', () => {
    // 擬似DOMの作成
    const container = document.createElement('div');
    const h1 = document.createElement('h1');
    const p1 = document.createElement('p');
    const h2 = document.createElement('h2');
    const p2 = document.createElement('p');

    container.appendChild(h1);
    container.appendChild(p1);
    container.appendChild(h2);
    container.appendChild(p2);

    // 1. H2を折りたたむ
    toggleHeadingCollapse(h2);
    expect(h2.classList.contains('is-collapsed')).toBe(true);
    expect(p2.classList.contains('collapsed-child')).toBe(true);

    // 2. H1を折りたたむ（全員非表示）
    toggleHeadingCollapse(h1);
    expect(p1.classList.contains('collapsed-child')).toBe(true);
    expect(h2.classList.contains('collapsed-child')).toBe(true);

    // 3. H1を再展開する（H2の中身p2は折りたたまれたまま維持されるべき）
    toggleHeadingCollapse(h1);
    expect(p1.classList.contains('collapsed-child')).toBe(false);
    expect(h2.classList.contains('collapsed-child')).toBe(false);
    expect(p2.classList.contains('collapsed-child')).toBe(true); // ★ 正常に非表示が維持されている
  });
});