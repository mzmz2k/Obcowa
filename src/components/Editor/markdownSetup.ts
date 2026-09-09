// Markdown文字列を安全なHTMLに変換し、独自記法(マークや画像、ダッシュボード拡張)を適用する

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { get } from 'svelte/store';
import { workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
import { generateImageHtml } from '../../lib/editor/imageViewer';
import { COPY_ICON_SVG } from './previewExtensions';
import { parseDataviewQuery } from '../../lib/utils/queryParser'; 

// marked のレンダラー内で現在のタブパスを参照するための一時変数
let currentTabPath = '';
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
            // Svelte Storeから現在のワークスペース情報を取得
            const currentWs = get(workspacesStore)[get(currentWorkspaceIndex)];
            const folders = currentWs?.image_folders || [];
            // グローバル変数として保持している現在のパスを使用
            return generateImageHtml(token.filename, currentTabPath, folders);
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

/**
 * BOMやフロントマター(メタデータ)を除去する
 */
export function removeFrontmatter(content: string) {
    return content.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * 危険なスクリプト等を除去した安全なHTMLを生成する
 */
export function sanitizeHtml(rawHtml: string): string {
    return DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['button', 'input'],
        ADD_ATTR: [
            'data-img-filename', 'data-primary-dirs', 'data-fallback-dir', 'data-cache-key',
            'data-task-index', 'type', 'checked', 'class',
            'data-widget-type', 'data-query', 'data-wiki-target'
        ]
    });
}

/**
 * Markdown文字列をパースしてHTMLに変換するメイン関数
 */
export function parseMarkdown(content: string, tabPath: string): string {
    initMarked();

    // Dataview風検索ブロックの置換
    content = content.replace(/```search([\s\S]*?)```/g, (match, queryBody) => {
    const { query, sortKey, sortOrder } = parseDataviewQuery(queryBody);
    return `<div class="dashboard-widget" data-widget-type="search" data-query="${query}" data-sort-key="${sortKey}" data-sort-order="${sortOrder}"></div>`;
    });

    // レンダラー(画像拡張等)内で使用するためにパスを一時保存
    currentTabPath = tabPath;
    const rawHtml = marked(removeFrontmatter(content));
    return rawHtml as string;
}