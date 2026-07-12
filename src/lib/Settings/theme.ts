import { writable } from 'svelte/store';

export interface Theme {
    id: string;
    name: string;
    bgColor: string;
    textColor: string;
    scrollBg: string;
    scrollThumb: string;
    accentColor: string;
    activeHighlightBg: string;
    menuBg: string;
    selectionBg: string; // 💥 追加: 文字選択時の背景色
}

export const defaultThemes: Theme[] = [
    {
        id: 'dark', name: 'ダーク', 
        bgColor: '#181d25', textColor: '#dbdde1', 
        scrollBg: '#111827', scrollThumb: '#4b5563', accentColor: '#9144bb',
        activeHighlightBg: '#3b185d', menuBg: '#201b23',
        selectionBg: '#403c67'
    },
    {
        id: 'light', name: 'ライト', 
        bgColor: '#ffffff', textColor: '#1f2937', 
        scrollBg: '#f3f4f6', scrollThumb: '#d1d5db', accentColor: '#3b82f6',
        activeHighlightBg: '#dbeafe', menuBg: '#f3f4f6',
        selectionBg: '#bfdbfe' 
    },
    {
        id: 'parchment', name: '羊皮紙', 
        bgColor: '#fdf6e3', textColor: '#5c4a3d', 
        scrollBg: '#ede0ce', scrollThumb: '#c9b49b', accentColor: '#8b5a2b',
        activeHighlightBg: '#f5deb3', menuBg: '#ede0ce',
        selectionBg: '#deb887'
    }
];

export const activeTheme = writable<Theme>(defaultThemes[0]);
export const customThemes = writable<Theme[]>([
    { ...defaultThemes[0], id: 'custom1', name: 'カスタム１' },
    { ...defaultThemes[0], id: 'custom2', name: 'カスタム２' },
    { ...defaultThemes[0], id: 'custom3', name: 'カスタム３' }
]);

// アプリ起動時のテーマ復元・補完処理を関数化
export function initTheme() {
    if (typeof window === 'undefined') return;

    try {
        const savedTheme = localStorage.getItem('activeTheme');
        if (savedTheme) {
            let t = JSON.parse(savedTheme);
            t.menuBg = t.menuBg || '#111827';
            t.selectionBg = t.selectionBg || '#4b5563'; // 💥 追加
            activeTheme.set(t);
        }
        
        const savedCustoms = localStorage.getItem('customThemes');
        if (savedCustoms) {
            let parsed = JSON.parse(savedCustoms);
            if (parsed.length >= 3) {
                parsed[0].id = 'custom1'; parsed[0].name = 'カスタム１';
                parsed[1].id = 'custom2'; parsed[1].name = 'カスタム２';
                parsed[2].id = 'custom3'; parsed[2].name = 'カスタム３';
            }
            // 💥 追加: selectionBg の補完も追加
            parsed = parsed.map((t: any) => ({...t, menuBg: t.menuBg || '#111827', selectionBg: t.selectionBg || '#4b5563'}));
            customThemes.set(parsed);
        }
    } catch (e) {
        console.error("テーマの復元に失敗しました", e);
    }
}

// テーマを画面全体（htmlのルート）に適用する処理を関数化
export function applyThemeToRoot(theme: Theme) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--bg-color', theme.bgColor);
    root.style.setProperty('--text-color', theme.textColor);
    root.style.setProperty('--scroll-bg', theme.scrollBg);
    root.style.setProperty('--scroll-thumb', theme.scrollThumb);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--active-highlight-bg', theme.activeHighlightBg);
    root.style.setProperty('--menu-bg', theme.menuBg);
    root.style.setProperty('--selection-bg', theme.selectionBg); // 💥 追加
}