// Mermaid記法のプレースホルダーを見つけ、SVG画像に変換して画面にマウントする責務を持つ

import mermaid from 'mermaid';

let initialized = false;

export async function loadMermaidInDom(container: HTMLElement) {
    const placeholders = container.querySelectorAll('.obsidian-mermaid-placeholder');
    if (placeholders.length === 0) return;

    // 初回のみ設定を初期化（アプリのCSS変数をそのまま渡してテーマに追従させる）
    if (!initialized) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                // 背景は透過、線や文字はアプリの文字色に合わせる
                background: 'transparent',
                primaryColor: 'transparent',
                primaryTextColor: 'var(--text-color)',
                primaryBorderColor: 'var(--text-color)',
                lineColor: 'var(--text-color)',
                textColor: 'var(--text-color)',
                mainBkg: 'color-mix(in srgb, var(--text-color) 5%, transparent)',
                nodeBorder: 'var(--text-color)',
                clusterBkg: 'color-mix(in srgb, var(--text-color) 3%, transparent)',
                clusterBorder: 'color-mix(in srgb, var(--text-color) 30%, transparent)'
            }
        });
        initialized = true;
    }

    for (let i = 0; i < placeholders.length; i++) {
        const el = placeholders[i] as HTMLElement;
        // サニタイズを避けて安全にコードを取り出すため、textContentから取得する
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
            el.innerHTML = `<div class="obsidian-embed-error" style="border: 1px solid red; padding: 1rem;">Mermaid Syntax Error</div>`;
            el.style.display = 'block';
        }
    }
}