// 編集エリアとプレビューエリア間のスクロール位置比率の計算を行う純粋関数

/**
 * 現在のスクロール位置からスクロール比率（0.0〜1.0）を計算する
 */
export function calculateScrollRatio(scrollTop: number, scrollHeight: number): number {
    if (scrollHeight <= 0) return 0;
    const ratio = scrollTop / scrollHeight;
    return Math.min(Math.max(ratio, 0), 1);
}

/**
 * スクロール比率からターゲット要素の目標scrollTopを計算する
 */
export function calculateScrollTopFromRatio(ratio: number, scrollHeight: number): number {
    if (scrollHeight <= 0) return 0;
    const clampedRatio = Math.min(Math.max(ratio, 0), 1);
    return clampedRatio * scrollHeight;
}