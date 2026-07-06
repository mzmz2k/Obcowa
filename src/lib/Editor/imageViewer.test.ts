// --- START OF src/lib/imageViewer.test.ts ---
import { describe, it, expect, vi } from 'vitest';
import { generateImageHtml, resetImageCache } from 'imageViewer';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

describe('ImageViewer Logic', () => {
    it('設定フォルダがない場合、元の階層を探す目印を生成する', () => {
        const html = generateImageHtml('image.png', 'C:/docs/note.md', '');
        expect(html).toContain('data-img-filename="image.png"');
        expect(html).toContain('data-fallback-dir="C:/docs"');
        expect(html).toContain('data-primary-dir=""');
    });

    it('設定フォルダがある場合、両方の探索目印を生成する', () => {
        const html = generateImageHtml('image.png', 'C:/docs/note.md', 'D:/Assets');
        expect(html).toContain('data-img-filename="image.png"');
        expect(html).toContain('data-primary-dir="D:/Assets"');
        expect(html).toContain('data-fallback-dir="C:/docs"');
    });
    
    it('サブフォルダ指定付きで書かれていても、ファイル名だけを抽出する', () => {
        const html = generateImageHtml('sub/folder/image.png|300', 'C:/docs/note.md', '');
        expect(html).toContain('data-img-filename="image.png"');
        expect(html).toContain('width="300"');
    });
});
// --- END OF src/lib/imageViewer.test.ts ---