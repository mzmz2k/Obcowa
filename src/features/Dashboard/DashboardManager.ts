// プレビュー画面上のプレースホルダー(div)にSvelteコンポーネントをマウント・アンマウントする (Svelte 5対応版)

import { mount, unmount } from 'svelte';
import SearchWidget from './widgets/SearchWidget.svelte';

// マウントしたコンポーネントのインスタンスを記憶しておくための配列
let activeWidgets: any[] = [];

/**
 * 前回の描画時にマウントしたすべてのウィジェットを破棄する
 */
export function unmountAllWidgets() {
    for (const widget of activeWidgets) {
        try {
            // Svelte 5 のAPIでコンポーネントを破棄してメモリを解放
            unmount(widget);
        } catch (e) {
            console.error("Failed to unmount widget:", e);
        }
    }
    activeWidgets = [];
}


/**
 * プレビュー画面のDOMを走査し、プレースホルダーにウィジェットを差し込む
 */
export function mountWidgets(container: HTMLElement) {
    unmountAllWidgets();

    const placeholders = container.querySelectorAll('.dashboard-widget');

    placeholders.forEach((el) => {
        
        const type = el.getAttribute('data-widget-type');
        
        if (type === 'search') {
            const query = el.getAttribute('data-query') || '';
            // ソート条件を属性から取得（未指定の場合はデフォルト値）
            const sortKey = el.getAttribute('data-sort-key') || 'updated';
            const sortOrder = el.getAttribute('data-sort-order') || 'desc';

            try {
                // Svelte 5 の新しいマウントAPIを使用
                const widget = mount(SearchWidget, {
                    target: el,
                    props: { query, sortKey, sortOrder }
                });
                activeWidgets.push(widget);
            } catch (e) {
                console.error("Failed to mount SearchWidget:", e);
                el.innerHTML = `<div style="color:red">Failed to load search widget</div>`;
            }
        }
    });
}