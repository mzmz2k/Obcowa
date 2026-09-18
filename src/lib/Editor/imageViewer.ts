// プレビュー内の画像プレースホルダーを検出し、ローカル画像の検索・バイナリ読込・Blobキャッシュと表示反映を行う
import { invoke } from '@tauri-apps/api/core';

// 💥 追加: メモリに保持する画像の最大数（これを超えると古いものから破棄される）
const MAX_CACHE_SIZE = 50; 
const imageBlobCache = new Map<string, string>();


/**
 * 画面上に存在する目印のついたimgタグを探し、Rust経由で画像を検索・読み込んで表示させます。
 * @param container 検索対象の親要素
 * @param activeTabPath 現在のタブのパス
 * @param imageFolders 検索対象のフォルダリスト
 */
export async function loadImagesInDom(container: HTMLElement, activeTabPath: string, imageFolders: string[] = []) {
    if (!container || !activeTabPath) return;
    
    const placeholders = container.querySelectorAll('img[data-img-filename]');
    const parentDir = activeTabPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');

    for (const img of placeholders) {
        const filename = img.getAttribute('data-img-filename');
        
        if (!filename) continue;

        // HTML側ではなく、実行時にキャッシュキーを生成する
        const cacheKey = imageFolders.length > 0 ? `${imageFolders.join('|')}/${filename}` : `${parentDir}/${filename}`;

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

            if (imageFolders.length > 0) {
                for (const dir of imageFolders) {
                    if (!dir) continue;
                    foundPath = await invoke('find_image_file', { dirPath: dir, fileName: filename });
                    if (foundPath) break;
                }
            }
            
            if (!foundPath && parentDir) {
                foundPath = await invoke('find_image_file', { dirPath: parentDir, fileName: filename });
            }

            if (foundPath) {
                // ★ テキスト用ではなく、バイナリ用の関数を呼び出す
                const bytes: number[] = await invoke('read_image_bytes', { path: foundPath });
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
}
// --- END OF src/lib/editor/imageViewer.ts ---