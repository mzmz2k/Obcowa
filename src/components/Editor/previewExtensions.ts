// プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作（描画・変換はしない）

import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { workspacesStore, currentWorkspaceIndex, openSearchTab, searchState, openFileInCurrentTab, openFileInNewTab, openTabs, switchTab } from '../../lib/stores';
import { getWorkspaceNodes, buildFilenameIndex, searchFilesByName } from '../../lib/workspace/treeUtils';

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
    const wsList = get(workspacesStore);
    const wsIndex = get(currentWorkspaceIndex);
    const targetNodes = getWorkspaceNodes(wsList, wsIndex, true);

    try {
        // 1. Rustへの送信をやめ、フロント側の辞書で完全一致を O(1) で探す
        const index = buildFilenameIndex(targetNodes);
        const exactMatches = index.get(targetName.trim().toLowerCase()) || [];
        
        console.log(`[WikiLink] exact matches: ${exactMatches.length}`);

        if (exactMatches.length === 1) {
            // 完全一致が1件ならそのファイルを開く
            const node = exactMatches[0];
            const filePath = node.path || node.original_path;
            
            // すでに開いているタブがあればそこに切り替える
            const tabs = get(openTabs);
            const existingTab = tabs.find(t => t.path === filePath);
            
            if (existingTab) {
                switchTab(existingTab.id);
            } else {
                // 文字列として直接受け取る
                const contentStr: string = await invoke('read_file_content', { path: filePath });
                
                // ワークスペース設定（新規タブで開くか）を取得
                const currentWs = wsList[wsIndex];
                if (currentWs?.open_in_new_tab) {
                    openFileInNewTab(filePath, node.name || targetName, contentStr);
                } else {
                    openFileInCurrentTab(filePath, node.name || targetName, contentStr);
                }
            }

        } else {
            // 0件、または2件以上の完全一致があった場合は、部分一致検索をJSで行って検索タブに渡す
            const searchResults = searchFilesByName(targetNodes, targetName);
            
            openSearchTab();
            searchState.update(state => ({
                ...state,
                query: targetName,
                searchByFilename: true,
                results: searchResults, // すでに検索した結果をストアに直接渡す！
                hasSearched: true       // 検索済みフラグを立てて結果を表示させる！
            }));
        }
    } catch (e) {
        console.error("[WikiLink] Search failed:", e);
    }
}