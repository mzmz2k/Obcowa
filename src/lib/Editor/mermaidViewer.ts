// Mermaid記法のプレースホルダーを見つけ、SVG画像に変換して画面にマウントする責務を持つ

import mermaid from 'mermaid';

/**
 * CSS変数（スペース区切りRGBなど）をブラウザの標準機能を使って
 * Mermaidが確実に認識できる rgb(r, g, b) 形式の文字列に変換するヘルパー関数
 */
function getResolvedColor(cssVar: string): string {
    const dummy = document.createElement('div');
    dummy.style.color = cssVar;
    dummy.style.display = 'none';
    document.body.appendChild(dummy);
    const computedColor = getComputedStyle(dummy).color;
    document.body.removeChild(dummy);
    return computedColor || '#888888';
}

export async function loadMermaidInDom(container: HTMLElement) {
    const placeholders = container.querySelectorAll('.obsidian-mermaid-placeholder');
    if (placeholders.length === 0) return;

    // 現在のテーマから具体的なRGBカラーを取得する
    const textColor = getResolvedColor('var(--text-color)');
    const bgColor = getResolvedColor('var(--bg-color)');

    // 描画のたびに設定を上書きすることで、テーマ変更にも動的に追従させる
    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
            background: bgColor,
            primaryColor: bgColor,       // 四角の中の基本色
            primaryTextColor: textColor,
            primaryBorderColor: textColor,
            lineColor: textColor,
            textColor: textColor,
            mainBkg: bgColor,            // 囲みなどの背景色
            nodeBorder: textColor,
            clusterBkg: bgColor,
            clusterBorder: textColor,
            titleColor: textColor,
            edgeLabelBackground: bgColor // 線の途中の文字の背景
        }
    });

    for (let i = 0; i < placeholders.length; i++) {
        const el = placeholders[i] as HTMLElement;
        const code = el.textContent?.trim();
        if (!code) continue;

        try {
            // Mermaidは一意のIDを要求するため生成する
            const id = `mermaid-svg-${Date.now()}-${i}`;
            const { svg } = await mermaid.render(id, code);
            
            // プレースホルダーをレンダリング済みのSVGに置き換える
            el.innerHTML = svg;
            el.classList.remove('obsidian-mermaid-placeholder');
            el.classList.add('obsidian-mermaid-rendered');
            
            // 中央寄せにしつつ、はみ出しを防ぐ
            el.style.display = 'flex';
            el.style.justifyContent = 'left';
            el.style.margin = '1.5rem 0';
            el.style.overflowX = 'auto';
            
            const svgNode = el.querySelector('svg');
            if (svgNode) {
                // ★修正: Mermaidが勝手に付ける 100% 幅指定を削除し、本来のサイズに戻す
                svgNode.removeAttribute('width');
                svgNode.removeAttribute('height');
                // 親要素（画面幅）を超えないようにだけ制限をかける
                svgNode.style.maxWidth = '50%';
                svgNode.style.height = 'auto';
            }
        } catch (err) {
            console.error("Mermaid render error:", err);
            el.innerHTML = `<div class="obsidian-embed-error" style="border: 1px solid red; padding: 1rem; border-radius: 4px;">Mermaid構文エラー: 記述が正しくありません</div>`;
            el.style.display = 'block';
        }
    }
}