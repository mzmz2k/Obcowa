// プレビュー表示拡張機能（タスク切り替え、コードコピー、見出し折りたたみ）のロジックとDOM操作

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
 */
export function toggleHeadingCollapse(headingEl: HTMLElement): void {
  const currentLevel = parseInt(headingEl.tagName.substring(1), 10);
  if (isNaN(currentLevel)) return;

  const isCollapsed = headingEl.classList.toggle('is-collapsed');

  let nextEl = headingEl.nextElementSibling as HTMLElement | null;
  while (nextEl) {
    const tagName = nextEl.tagName;
    if (/^H[1-6]$/.test(tagName)) {
      const nextLevel = parseInt(tagName.substring(1), 10);
      // 自分と同じかより上位の見出しが現れたら走査終了
      if (nextLevel <= currentLevel) {
        break;
      }
    }

    if (isCollapsed) {
      nextEl.classList.add('collapsed-child');
    } else {
      nextEl.classList.remove('collapsed-child');
    }

    nextEl = nextEl.nextElementSibling as HTMLElement | null;
  }
}