// --- START OF src/lib/editor/imageViewer.ts ---
import { invoke } from '@tauri-apps/api/core';

// 💥 追加: メモリに保持する画像の最大数（これを超えると古いものから破棄される）
const MAX_CACHE_SIZE = 50; 
const imageBlobCache = new Map<string, string>();

/**
 * Obsidian形式の画像リンク文字列から、HTMLのimgタグ（プレースホルダー）を生成します。
 */
export function generateImageHtml(filenameWithOpts: string, activeTabPath: string, imageFolderPath: string = ''): string {
    if (!activeTabPath) return '';

    const parts = filenameWithOpts.split('|');
    const rawFilename = parts[0].trim();
    const filename = rawFilename.split(/[/\\]/).pop() || rawFilename;
    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    const cacheKey = imageFolderPath ? `${imageFolderPath}/${filename}` : `${parentDir}/${filename}`;

    return `<img data-img-filename="${filename}" data-primary-dir="${imageFolderPath}" data-fallback-dir="${parentDir}" data-cache-key="${cacheKey}" alt="${filename}"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: rgba(0,0,0,0.1);" />`;
}

/**
 * 画面上に存在する目印のついたimgタグを探し、Rust経由で画像を検索・読み込んで表示させます。
 */
export async function loadImagesInDom() {
    const placeholders = document.querySelectorAll('img[data-img-filename]');
    for (const img of placeholders) {
        const filename = img.getAttribute('data-img-filename');
        const primaryDir = img.getAttribute('data-primary-dir');
        const fallbackDir = img.getAttribute('data-fallback-dir');
        const cacheKey = img.getAttribute('data-cache-key');
        
        if (!filename || !cacheKey) continue;

        if (imageBlobCache.has(cacheKey)) {
            // 💥 追加: 使われた画像を「最新」として扱うため、一度消して一番後ろに再登録する
            const cachedUrl = imageBlobCache.get(cacheKey)!;
            imageBlobCache.delete(cacheKey);
            imageBlobCache.set(cacheKey, cachedUrl);

            img.setAttribute('src', cachedUrl);
            img.removeAttribute('data-img-filename');
            continue;
        }

        try {
            let foundPath: string | null = null;

            if (primaryDir) {
                foundPath = await invoke('find_image_file', { dirPath: primaryDir, fileName: filename });
            }
            
            if (!foundPath && fallbackDir) {
                foundPath = await invoke('find_image_file', { dirPath: fallbackDir, fileName: filename });
            }

            if (foundPath) {
                const bytes: number[] = await invoke('read_file_content', { path: foundPath });
                setImageData(img, cacheKey, bytes);
            } else {
                throw new Error("File not found in any directory");
            }
        } catch (err) {
            img.setAttribute('alt', `❌ 読込失敗: ${filename}`);
            img.removeAttribute('data-img-filename');
        }
    }
}

// 読み込んだバイナリデータを画面に反映させる補助関数
function setImageData(img: Element, cacheKey: string, bytes: number[]) {
    // 💥 変更: oldestKey が undefined ではないことをVSCodeに保証する書き方に変更
    if (imageBlobCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = imageBlobCache.keys().next().value;
        
        // oldestKey がちゃんと文字列として取れた場合のみ削除処理を行う
        if (oldestKey !== undefined) {
            const oldestUrl = imageBlobCache.get(oldestKey);
            if (oldestUrl) {
                URL.revokeObjectURL(oldestUrl);
            }
            imageBlobCache.delete(oldestKey);
        }
    }

    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    
    imageBlobCache.set(cacheKey, blobUrl);
    img.setAttribute('src', blobUrl);
    img.removeAttribute('data-img-filename');
    img.removeAttribute('data-primary-dir');
    img.removeAttribute('data-fallback-dir');
    img.removeAttribute('data-cache-key');
}
// --- END OF src/lib/editor/imageViewer.ts ---