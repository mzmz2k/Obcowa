// Mermaid記法のプレースホルダーを見つけ、SVG画像に変換して画面にマウントする責務を持つ

import mermaid from 'mermaid';

export async function loadMermaidInDom(container: HTMLElement) {
    const placeholders = container.querySelectorAll('.obsidian-mermaid-placeholder');
    if (placeholders.length === 0) return;

    // ★修正: MermaidはCSS変数名や color-mix を内部で計算できないため、
    // 現在の画面に適用されている「実際の色の計算値（rgb(255,255,255)など）」を取得する
    const styles = getComputedStyle(container);
    const textColor = styles.getPropertyValue('--text-color').trim() || '#ffffff';
    const bgColor = styles.getPropertyValue('--bg-color').trim() || '#1e293b'; // 取得できない場合のフォールバック

    // 描画のたびに設定を上書きすることで、テーマ変更にも動的に追従させる
    mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
            background: bgColor,
            primaryColor: bgColor,
            primaryTextColor: textColor,
            primaryBorderColor: textColor,
            lineColor: textColor,
            textColor: textColor,
            mainBkg: bgColor,
            nodeBorder: textColor,
            clusterBkg: bgColor,
            clusterBorder: textColor
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
            
            // はみ出さないようにスタイリング
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.margin = '1.5rem 0';
            el.style.overflowX = 'auto';
            
            const svgNode = el.querySelector('svg');
            if (svgNode) {
                svgNode.style.maxWidth = '100%';
                svgNode.style.height = 'auto';
            }
        } catch (err) {
            console.error("Mermaid render error:", err);
            el.innerHTML = `<div class="obsidian-embed-error" style="border: 1px solid red; padding: 1rem; border-radius: 4px;">Mermaid構文エラー: 記述が正しくありません</div>`;
            el.style.display = 'block';
        }
    }
}