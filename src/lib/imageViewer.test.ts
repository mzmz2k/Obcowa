// --- START OF src/lib/imageViewer.ts ---
import { invoke } from '@tauri-apps/api/core';
import { describe, it, expect, vi } from 'vitest';
import { generateImageHtml, resetImageCache } from './imageViewer';

// 生成した画像URLを一時保存するキャッシュ
const imageBlobCache = new Map<string, string>();

/**
 * Obsidian形式の画像リンク文字列から、HTMLのimgタグ（プレースホルダー）を生成します。
 */
export function generateImageHtml(filenameWithOpts: string, activeTabPath: string): string {
    if (!activeTabPath) return '';

    const parts = filenameWithOpts.split('|');
    const filename = parts[0].trim();
    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    const cleanFilename = filename.replace(/\\/g, '/').replace(/^\//, '');
    const absoluteImagePath = `${parentDir}/${cleanFilename}`;

    // すでに画像を読み込み済みの場合は、そのURLを直接返す（入力中のチラつき防止）
    if (imageBlobCache.has(absoluteImagePath)) {
        return `<img src="${imageBlobCache.get(absoluteImagePath)}" alt="${filename}"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0;" />`;
    }

    // まだ読み込んでいない場合は、目印（data-local-image）をつけた空のimgタグを返す
    return `<img data-local-image="${absoluteImagePath}" alt="${filename} (読込中...)"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: rgba(0,0,0,0.1);" />`;
}

/**
 * 画面上に存在する目印のついたimgタグを探し、Rust経由で画像を読み込んで表示させます。
 */
export async function loadImagesInDom() {
    const placeholders = document.querySelectorAll('img[data-local-image]');
    for (const img of placeholders) {
        const path = img.getAttribute('data-local-image');
        if (!path) continue;

        if (imageBlobCache.has(path)) {
            img.setAttribute('src', imageBlobCache.get(path)!);
            img.removeAttribute('data-local-image');
            continue;
        }

        try {
            // 既存のファイル読み込みコマンドを使って画像のバイナリデータを取得
            const bytes: number[] = await invoke('read_file_content', { path });
            const uint8Array = new Uint8Array(bytes);
            
            // ブラウザが表示できるBlob URLに変換
            const blob = new Blob([uint8Array], { type: getMimeType(path) });
            const blobUrl = URL.createObjectURL(blob);
            
            imageBlobCache.set(path, blobUrl);
            img.setAttribute('src', blobUrl);
            img.removeAttribute('data-local-image');
        } catch (err) {
            console.error("画像の読み込みに失敗しました:", path, err);
            img.setAttribute('alt', `❌ 読込失敗: ${path.split('/').pop()}`);
            img.removeAttribute('data-local-image');
        }
    }
}

/**
 * タブを切り替えた時に、そのファイルの画像キャッシュを破棄します。
 * これにより「タブを開く都度に画像を新しく読み込む」ことができます。
 */
export function resetImageCache(activeTabPath: string) {
    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    for (const [path, url] of imageBlobCache.entries()) {
        if (path.startsWith(parentDir)) {
            URL.revokeObjectURL(url); // メモリ解放
            imageBlobCache.delete(path);
        }
    }
}

// 拡張子から画像の種類を判別する補助関数
function getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'svg': return 'image/svg+xml';
        default: return 'application/octet-stream';
    }
}

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

describe('ImageViewer Logic', () => {
    it('設定フォルダがない場合、元の階層のみを探すプレースホルダーを生成する', () => {
        const html = generateImageHtml('image.png', 'C:/docs/note.md', '');
        expect(html).toContain('data-local-image="C:/docs/image.png"');
        expect(html).not.toContain('data-fallback-image');
    });

    it('設定フォルダがある場合、優先パスと予備パス（fallback）の両方を生成する', () => {
        const html = generateImageHtml('image.png', 'C:/docs/note.md', 'D:/Assets');
        expect(html).toContain('data-local-image="D:/Assets/image.png"');
        expect(html).toContain('data-fallback-image="C:/docs/image.png"');
    });
});
// --- END OF src/lib/imageViewer.ts ---