// Markdown文字列や独自ウィジェットなどを安全なHTMLに変換する

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { COPY_ICON_SVG } from './previewExtensions';
import { parseDataviewQuery } from '../../lib/utils/queryParser'; 

let isMarkedInitialized = false;

// marked レンダラーの this 型定義
interface MarkedRendererThis {
    parser?: {
        parse(tokens: unknown[]): string;
        parseInline(tokens: unknown[]): string;
    };
    lexer?: {
        inlineTokens(src: string): any[];
    };
}

/**
 * 初回のみ marked のカスタマイズ設定を適用する
 */
function initMarked() {
    if (isMarkedInitialized) return;

    // 1. < のエスケープ
    const hooks = {
        preprocess(src: string) {
            return src.replace(/</g, "&lt;");
        }
    };

    // 2. ==ハイライト== 記法
    const highlightExtension = {
        name: 'highlight',
        level: 'inline',
        start(src: string) { return src.match(/==/)?.index; },
        tokenizer(src: string, tokens: any) {
            const rule = /^==([\s\S]+?)==/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'highlight',
                    raw: match[0],
                    text: match[1],
                    tokens: this.lexer.inlineTokens(match[1]) 
                };
            }
        },
        renderer(token: any) {
            return `<mark class="obsidian-highlight">${this.parser.parseInline(token.tokens)}</mark>`;
        }
    };

    // 3. ![[画像]] 記法
    const obsidianImageExtension = {
        name: 'obsidianImage',
        level: 'inline',
        start(src: string) { return src.match(/!\[\[/)?.index; },
        tokenizer(src: string, tokens: any) {
            const rule = /^!\[\[([\s\S]+?)\]\]/;
            const match = rule.exec(src);
            if (match) return { type: 'obsidianImage', raw: match[0], filename: match[1] };
        },
        renderer(token: any) {
            // ストアやパスに依存せず、プレースホルダーを返すだけにする
            const parts = token.filename.split('|');
            const rawFilename = parts[0].trim();
            const filename = rawFilename.split(/[/\\]/).pop() || rawFilename;
            const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';
            return `<img data-img-filename="${filename}"${sizeAttr} alt="${filename}" style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: var(--active-highlight-bg);" />`;
        }
    };

        // 3.5. [[Wikiリンク]] 記法 (エイリアス対応: [[リンク先|表示名]])
    const wikiLinkExtension = {
        name: 'wikiLink',
        level: 'inline',
        start(src: string) { return src.match(/\[\[/)?.index; },
        tokenizer(src: string, tokens: any) {
            const rule = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'wikiLink',
                    raw: match[0],
                    target: match[1], // リンク先のファイル名
                    text: match[2] || match[1] // エイリアスがあればそれを使用
                };
            }
        },
        renderer(token: any) {
            return `<a href="#" class="obsidian-wiki-link" data-wiki-target="${token.target}">${token.text}</a>`;
        }
    };


    // 4. 標準要素のカスタマイズ
    const customRenderer = {
        heading(this: MarkedRendererThis, textOrToken: any, levelArg?: number) {
            let text = '';
            let level = 1;
            if (typeof textOrToken === 'object' && textOrToken !== null) {
                level = textOrToken.depth || 1;
                if (textOrToken.tokens && this.parser) {
                    try { text = this.parser.parseInline(textOrToken.tokens); } 
                    catch { text = textOrToken.text || ''; }
                } else {
                    text = textOrToken.text || '';
                }
            } else {
                text = String(textOrToken || '');
                level = levelArg || 1;
            }
            return `<h${level}><span class="heading-toggle" title="折りたたみ"></span>${text}</h${level}>\n`;
        },

        code(codeOrToken: any, infostring?: string, escaped?: boolean) {
            let codeStr = '';
            let lang = '';
            let isEscaped = false;

            if (typeof codeOrToken === 'object' && codeOrToken !== null) {
                codeStr = codeOrToken.text || '';
                lang = codeOrToken.lang || '';
                isEscaped = !!codeOrToken.escaped;
            } else {
                codeStr = String(codeOrToken || '');
                lang = infostring || '';
                isEscaped = !!escaped;
            }

            // ★ ダッシュボード用ウィジェットの判定
            if (lang.startsWith('obcowa-search')) {
                const match = lang.match(/obcowa-search\((.*?)\)/);
                const query = match ? match[1] : '';
                return `<div class="dashboard-widget" data-widget-type="search" data-query="${query}"></div>`;
            }

            const matchedLang = lang.match(/\S*/)?.[0] || '';
            const escapedCode = isEscaped ? codeStr : codeStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
                <div class="code-block-wrapper">
                    <button type="button" class="code-copy-btn" title="コードをコピー">${COPY_ICON_SVG}</button>
                    <pre><code class="language-${matchedLang}">${escapedCode}</code></pre>
                </div>
            `;
        },

        listitem(this: MarkedRendererThis, itemOrText: any, taskArg?: boolean, checkedArg?: boolean) {
            let text = '';
            let isTask = false;
            let isChecked = false;

            if (typeof itemOrText === 'object' && itemOrText !== null) {
                isTask = !!itemOrText.task;
                isChecked = !!itemOrText.checked;
                if (itemOrText.tokens && this.parser) {
                    try { text = this.parser.parse(itemOrText.tokens); } 
                    catch { text = itemOrText.text || ''; }
                } else {
                    text = itemOrText.text || '';
                }
            } else {
                text = String(itemOrText || '');
                isTask = !!taskArg;
                isChecked = !!checkedArg;
            }

            if (isTask) {
                const cleanText = text
                    .replace(/^<p>/, '')
                    .replace(/<\/p>\n?$/, '')
                    .replace(/^<input[^>]*>\s*/, '')
                    .replace(/^\[[ xX]\]\s*/, '');
                const checkedAttr = isChecked ? 'checked' : '';
                return `<li class="task-list-item"><input type="checkbox" class="task-checkbox" ${checkedAttr} /><span class="task-content">${cleanText}</span></li>\n`;
            }
            return `<li>${text}</li>\n`;
        }
    };

    marked.use({ 
        breaks: true, 
        hooks, 
        extensions: [highlightExtension, obsidianImageExtension, wikiLinkExtension],
        renderer: customRenderer
    });

    isMarkedInitialized = true;
}

const FRONTMATTER_REGEX = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/**
 * BOMやフロントマター(メタデータ)を除去する
 */
export function removeFrontmatter(content: string) {
        return content.replace(FRONTMATTER_REGEX, '');
}

// 折りたたみ用の矢印アイコン (下向きChevron)
const CHEVRON_DOWN_SVG = `<svg class="properties-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

/**
 * フロントマターを解析し、Obsidian風のプロパティカードHTMLを生成する
 */
function renderPropertiesCard(yamlText: string): string {

    const lines = yamlText.split('\n');
    const properties: { key: string; values: string[] }[] = [];
    let currentProp: { key: string; values: string[] } | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // YAMLの複数行リスト（- タグ名）の処理
        if (line.startsWith('-')) {
            const val = line.replace(/^-\s*/, '').trim();
            if (currentProp) {
                currentProp.values.push(val);
            }
            continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.slice(0, colonIndex).trim();

            const rest = line.slice(colonIndex + 1).trim();
            currentProp = { key, values: [] };
            properties.push(currentProp);

            if (rest) {
                // [tag1, tag2] のようなインライン配列
                if (rest.startsWith('[') && rest.endsWith(']')) {
                    const items = rest.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                    currentProp.values.push(...items);
                } else {
                    currentProp.values.push(rest.replace(/^['"]|['"]$/g, ''));
                }
            }
        }
    }

    let rowsHtml = '';
    for (const prop of properties) {
        const isTag = prop.key.toLowerCase() === 'tags' || prop.key.toLowerCase() === 'tag';
        let valuesHtml = '';

        if (isTag) {
            // タグは # を付けたバッジにする
            valuesHtml = prop.values.map(v => {
                const tagText = v.startsWith('#') ? v : `#${v}`;
                return `<span class="obsidian-property-tag" data-tag="${v}">${tagText}</span>`;
            }).join('');
        } else {
            valuesHtml = prop.values.map(v => `<span class="obsidian-property-text">${v}</span>`).join(', ');
        }

        rowsHtml += `
        <div class="obsidian-property-row">
            <div class="obsidian-property-key">${prop.key}</div>
            <div class="obsidian-property-value">${valuesHtml}</div>
        </div>`;
    }

    return `
    <div class="obsidian-properties-card">
        <div class="obsidian-properties-header" title="プロパティを折りたたむ">
            ${CHEVRON_DOWN_SVG}
            <span class="obsidian-properties-title">PROPERTIES</span>
        </div>
        <div class="obsidian-properties-body">${rowsHtml}</div>
    </div>\n
    `;
}

/**
 * 危険なスクリプト等を除去した安全なHTMLを生成する
 */
export function sanitizeHtml(rawHtml: string): string {
    return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['button', 'input'],
        ADD_ATTR: [
            'data-img-filename', 'data-task-index', 'type', 'checked', 'class',
            'data-widget-type', 'data-query', 'data-wiki-target',
            'style', 'width', 'alt' // ★追加: 画像の表示崩れを防ぐ
        ]
    });
}

/**
 * Markdown文字列をパースしてHTMLに変換するメイン関数
 */
export function parseMarkdown(content: string, tabPath: string, showProperties: boolean = false): string {
    initMarked();
 
    let propertiesHtml = '';
    const match = content.match(FRONTMATTER_REGEX);

    if (match) {
        if (showProperties) {
            propertiesHtml = renderPropertiesCard(match[1]);
        }
        content = content.replace(FRONTMATTER_REGEX, '');
    }

    // Dataview風検索ブロックの置換
    content = content.replace(/```search([\s\S]*?)```/g, (match, queryBody) => {
    const { query, sortKey, sortOrder } = parseDataviewQuery(queryBody);
    return `<div class="dashboard-widget" data-widget-type="search" data-query="${query}" data-sort-key="${sortKey}" data-sort-order="${sortOrder}"></div>`;
    });

    const rawHtml = marked(removeFrontmatter(content));
    return propertiesHtml + (rawHtml as string);
}