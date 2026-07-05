// --- START OF src/lib/imageViewer.ts ---
import { invoke } from '@tauri-apps/api/core';

const imageBlobCache = new Map<string, string>();

/**
 * Obsidian形式の画像リンク文字列から、HTMLのimgタグ（プレースホルダー）を生成します。
 */
export function generateImageHtml(filenameWithOpts: string, activeTabPath: string, imageFolderPath: string = ''): string {
    if (!activeTabPath) return '';

    const parts = filenameWithOpts.split('|');
    const filename = parts[0].trim();
    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    const cleanFilename = filename.replace(/\\/g, '/').replace(/^\//, '');
    
    // 💥 変更: 設定フォルダがあればそれを最優先し、元の階層は「予備(fallback)」とする
    let primaryPath = `${parentDir}/${cleanFilename}`;
    let fallbackPath = '';

    if (imageFolderPath.trim() !== '') {
        primaryPath = `${imageFolderPath.replace(/\\/g, '/')}/${cleanFilename}`;
        fallbackPath = `${parentDir}/${cleanFilename}`;
    }

    if (imageBlobCache.has(primaryPath)) {
        return `<img src="${imageBlobCache.get(primaryPath)}" alt="${filename}"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0;" />`;
    }
    if (fallbackPath && imageBlobCache.has(fallbackPath)) {
        return `<img src="${imageBlobCache.get(fallbackPath)}" alt="${filename}"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0;" />`;
    }

    const fallbackAttr = fallbackPath ? ` data-fallback-image="${fallbackPath}"` : '';

    return `<img data-local-image="${primaryPath}"${fallbackAttr} alt="${filename} (読込中...)"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: rgba(0,0,0,0.1);" />`;
}

/**
 * 画面上に存在する目印のついたimgタグを探し、Rust経由で画像を読み込んで表示させます。
 */
export async function loadImagesInDom() {
    const placeholders = document.querySelectorAll('img[data-local-image]');
    for (const img of placeholders) {
        const primaryPath = img.getAttribute('data-local-image');
        const fallbackPath = img.getAttribute('data-fallback-image');
        if (!primaryPath) continue;

        if (imageBlobCache.has(primaryPath)) {
            img.setAttribute('src', imageBlobCache.get(primaryPath)!);
            img.removeAttribute('data-local-image');
            img.removeAttribute('data-fallback-image');
            continue;
        }

        try {
            // 1. まず優先パス（設定フォルダ）から読み込みを試す
            const bytes: number[] = await invoke('read_file_content', { path: primaryPath });
            setImageData(img, primaryPath, bytes);
        } catch (err) {
            // 2. 失敗した場合、予備パス（元のフォルダ階層）があればそちらを試す
            if (fallbackPath) {
                try {
                    const fallbackBytes: number[] = await invoke('read_file_content', { path: fallbackPath });
                    setImageData(img, fallbackPath, fallbackBytes);
                    continue;
                } catch (fallbackErr) {
                    // 両方失敗した場合は下の「失敗」処理へ進む
                }
            }
            img.setAttribute('alt', `❌ 読込失敗: ${primaryPath.split('/').pop()}`);
            img.removeAttribute('data-local-image');
        }
    }
}

// 読み込んだバイナリデータを画面に反映させる補助関数
function setImageData(img: Element, path: string, bytes: number[]) {
    const uint8Array = new Uint8Array(bytes);
    const blob = new Blob([uint8Array], { type: getMimeType(path) });
    const blobUrl = URL.createObjectURL(blob);
    
    imageBlobCache.set(path, blobUrl);
    img.setAttribute('src', blobUrl);
    img.removeAttribute('data-local-image');
    img.removeAttribute('data-fallback-image');
}

export function resetImageCache(activeTabPath: string, imageFolderPath: string = '') {
    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    const imgDir = imageFolderPath ? imageFolderPath.replace(/\\/g, '/') : parentDir;

    for (const [path, url] of imageBlobCache.entries()) {
        if (path.startsWith(parentDir) || path.startsWith(imgDir)) {
            URL.revokeObjectURL(url);
            imageBlobCache.delete(path);
        }
    }
}

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
// --- END OF src/lib/imageViewer.ts ---