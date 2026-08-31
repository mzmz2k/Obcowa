// プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作

import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { workspaces, currentWorkspaceIndex, openSearchTab, searchState, openFileInCurrentTab } from '../../lib/stores';
import { findNodesByBaseName, getWorkspaceNodes } from '../../lib/workspace/treeUtils';

export const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
export const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;


/**
 * Markdown内の targetIndex 番目のタスク状態（[ ] ↔ [x]）を反転します。
 * コードブロック（```）内のタスク記法はカウント対象外にします。
 */
export function toggleTaskMarkdown(content: string, targetIndex: number): string {
  let currentIndex = 0;
  let inCodeBlock = false;
  const lines = content.split('\n');

  const updatedLines = lines.map((line) => {
    // コードブロックの開始/終了判定
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return line;
    }

    if (inCodeBlock) {
      return line;
    }

    // 行内でタスクブラケット [ ] または [x] を検出してインデックス単位で置換
    return line.replace(/\[([ xX])\]/g, (match, p1) => {
      if (currentIndex === targetIndex) {
        currentIndex++;
        const newChar = p1 === ' ' ? 'x' : ' ';
        return `[${newChar}]`;
      }
      currentIndex++;
      return match;
    });
  });

  return updatedLines.join('\n');
}

/**
 * コードブロック内のテキストをクリップボードにコピーします。
 */
export async function copyCodeBlock(buttonEl: HTMLElement): Promise<boolean> {
  const wrapper = buttonEl.closest('.code-block-wrapper');
  if (!wrapper) return false;

  const codeEl = wrapper.querySelector('code');
  if (!codeEl) return false;

  const textToCopy = codeEl.textContent || '';
  try {
    await navigator.clipboard.writeText(textToCopy);
    return true;
  } catch (err) {
    console.error('Failed to copy code block:', err);
    return false;
  }
}

/**
 * 見出し要素配下のコンテンツを表示/非表示トグルします。
 * ネストされた上位・下位見出しの折りたたみ状態を正確に保持・再計算します。
 */
export function toggleHeadingCollapse(headingEl: HTMLElement): void {
  const container = headingEl.parentElement;
  if (!container) return;

  // 1. クリックされた見出し自身の折りたたみ状態をトグル
  headingEl.classList.toggle('is-collapsed');

  // 2. レベルごとの折りたたみ状態を追跡するスタック (index 1 = H1, index 6 = H6)
  const collapsedAtLevel: boolean[] = [false, false, false, false, false, false, false];

  const children = Array.from(container.children) as HTMLElement[];

  // プレビューコンテナ内の要素を上から順に走査し、表示/非表示状態を正しく反映
  for (const child of children) {
    const tagName = child.tagName;

    if (/^H[1-6]$/.test(tagName)) {
      const level = parseInt(tagName.substring(1), 10);

      // 自分より下位のレベルの折りたたみ状態はリセット
      for (let l = level + 1; l <= 6; l++) {
        collapsedAtLevel[l] = false;
      }

      // 自分自身の折りたたみフラグを記録
      collapsedAtLevel[level] = child.classList.contains('is-collapsed');

      // 自分より上位レベル（1〜level-1）のいずれかが折りたたまれていれば非表示
      const isParentCollapsed = collapsedAtLevel.slice(1, level).some(Boolean);

      if (isParentCollapsed) {
        child.classList.add('collapsed-child');
      } else {
        child.classList.remove('collapsed-child');
      }
    } else {
      // 見出し以外の本文・リスト要素等
      // レベル1〜6のいずれかの親見出しが折りたたまれていれば非表示
      const isAnyParentCollapsed = collapsedAtLevel.some(Boolean);

      if (isAnyParentCollapsed) {
        child.classList.add('collapsed-child');
      } else {
        child.classList.remove('collapsed-child');
      }
    }
  }
}

/**
 * Wikiリンクがクリックされた時の処理
 */
export async function handleWikiLinkClick(targetEl: HTMLElement) {
    const targetName = targetEl.getAttribute('data-wiki-target');
    if (!targetName) return;

    // ライブラリを含むワークスペースの全ノードを取得
    const wsList = get(workspaces);
    const wsIndex = get(currentWorkspaceIndex);
    const targetNodes = getWorkspaceNodes(wsList, wsIndex, true);

    const matchedNodes = findNodesByBaseName(targetNodes, targetName);

    if (matchedNodes.length === 1) {
        const node = matchedNodes[0];
        const filePath = node.original_path || node.path;
        try {
            // ファイルの中身を読み込んでタブで開く
            const contentBytes: number[] = await invoke('read_file_content', { path: filePath });
            const contentStr = new TextDecoder().decode(new Uint8Array(contentBytes));
            // ※ ワークスペース設定による新規タブ/現在タブの切り替え処理があれば、ここを修正してください
            openFileInCurrentTab(filePath, node.name, contentStr);
        } catch (e) {
            console.error("Failed to read file", e);
        }
    } else {
        // 0件または2件以上の場合は検索タブを開き、ファイル名検索を実行
        openSearchTab();
        searchState.update(state => ({
            ...state,
            query: targetName,
            searchByFilename: true,
            hasSearched: false // ウィジェットに検索を促す
        }));
    }
}