// --- START OF src/lib/imageViewer.ts ---
import { invoke } from '@tauri-apps/api/core';

const imageBlobCache = new Map<string, string>();

/**
 * Obsidian形式の画像リンク文字列から、HTMLのimgタグ（プレースホルダー）を生成します。
 */
export function generateImageHtml(filenameWithOpts: string, activeTabPath: string, imageFolderPath: string = ''): string {
    if (!activeTabPath) return '';

    const parts = filenameWithOpts.split('|');
    const rawFilename = parts[0].trim();
    // フォルダ指定付き（sub/image.pngなど）で書かれていても、純粋なファイル名だけを抽出する
    const filename = rawFilename.split(/[/\\]/).pop() || rawFilename;
    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

    // 探索の起点となる元のフォルダ
    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    
    // キャッシュキー
    const cacheKey = imageFolderPath ? `${imageFolderPath}/${filename}` : `${parentDir}/${filename}`;

    if (imageBlobCache.has(cacheKey)) {
        return `<img src="${imageBlobCache.get(cacheKey)}" alt="${filename}"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0;" />`;
    }

    // パスではなく、「探すべきファイル名」と「探すべきディレクトリ」を目印として埋め込む
    return `<img data-img-filename="${filename}" data-primary-dir="${imageFolderPath}" data-fallback-dir="${parentDir}" data-cache-key="${cacheKey}" alt="${filename} (読込中...)"${sizeAttr} style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: rgba(0,0,0,0.1);" />`;
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
            img.setAttribute('src', imageBlobCache.get(cacheKey)!);
            img.removeAttribute('data-img-filename');
            continue;
        }

        try {
            let foundPath: string | null = null;

            // 1. まず優先フォルダ（設定フォルダ）の奥深くまで探す
            if (primaryDir) {
                foundPath = await invoke('find_image_file', { dirPath: primaryDir, fileName: filename });
            }
            
            // 2. 見つからなければ、元のファイル階層の奥深くまで探す
            if (!foundPath && fallbackDir) {
                foundPath = await invoke('find_image_file', { dirPath: fallbackDir, fileName: filename });
            }

            if (foundPath) {
                // 発見した絶対パスを使って画像を読み込む
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
    // MIMEタイプの推測は仮置き（ブラウザは中身で判別してくれるためoctet-streamでも表示されます）
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    
    imageBlobCache.set(cacheKey, blobUrl);
    img.setAttribute('src', blobUrl);
    img.removeAttribute('data-img-filename');
    img.removeAttribute('data-primary-dir');
    img.removeAttribute('data-fallback-dir');
    img.removeAttribute('data-cache-key');
}

export function resetImageCache(activeTabPath: string, imageFolderPath: string = '') {
    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
    const imgDir = imageFolderPath ? imageFolderPath.replace(/\\/g, '/') : parentDir;

    for (const [key, url] of imageBlobCache.entries()) {
        if (key.startsWith(parentDir) || key.startsWith(imgDir)) {
            URL.revokeObjectURL(url);
            imageBlobCache.delete(key);
        }
    }
}