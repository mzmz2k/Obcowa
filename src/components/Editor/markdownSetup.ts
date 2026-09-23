// Markdown文字列や独自ウィジェットなどを安全なHTMLに変換する

import DOMPurify from 'dompurify';
import { COPY_ICON_SVG } from './previewExtensions';
import { parseDataviewQuery } from '../../lib/utils/queryParser';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Parent } from 'unist';
import type { Root as MdastRoot, Text, HTML, Code, Heading, Yaml } from 'mdast';
import type { Root as HastRoot, Element as HastElement } from 'hast';


const FRONTMATTER_REGEX = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/**
 * BOMやフロントマター(メタデータ)を除去する（外部モジュール参照用）
 */
export function removeFrontmatter(content: string) {
        return content.replace(FRONTMATTER_REGEX, '');
}


/**
 * [AST Plugin] ユーザ入力の生HTMLタグを安全なテキストにエスケープ（既存のpreprocess互換）
 */
function remarkEscapeUserHtml() {
    return (tree: MdastRoot) => {
        visit(tree, 'html', (node: HTML) => {
            const textNode = node as unknown as Text;
            textNode.type = 'text';
            textNode.value = node.value.replace(/</g, "&lt;");
        });
    };
}

/**
 * [AST Plugin] フロントマターYAMLを抽出し、プロパティカードのHTMLに置換する
 */
function remarkPropertiesCard(options: { showProperties: boolean }) {
    return (tree: MdastRoot) => {
        let yamlNodeIndex = -1;
        let yamlContent = '';

        visit(tree, 'yaml', (node: Yaml, index: number | undefined) => {
            if (yamlNodeIndex === -1 && index !== undefined) {
                yamlNodeIndex = index;
                yamlContent = node.value;
            }
        });

        if (yamlNodeIndex !== -1) {
            if (options.showProperties) {
                const html = renderPropertiesCard(yamlContent);
                tree.children.splice(yamlNodeIndex, 1, { type: 'html', value: html } as HTML);
            } else {
                tree.children.splice(yamlNodeIndex, 1);
            }
        }
    };
}

/**
 * [AST Plugin] Obsidian独自記法（ハイライト, 画像, Wikiリンク）のパース
 */
function remarkObsidianExtensions() {
    return (tree: MdastRoot) => {
        visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
            if (!parent || index === undefined) return;
            
            const text = node.value;
            const regex = /(==[\s\S]+?==|!\[\[[\s\S]+?\]\]|\[\[[^\]]+\]\])/g;
            let lastIndex = 0;
            let match;
            const newNodes: (Text | HTML)[] = [];

            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    newNodes.push({ type: 'text', value: text.slice(lastIndex, match.index) });
                }

                const matchedStr = match[0];
                if (matchedStr.startsWith('==') && matchedStr.endsWith('==')) {
                    const innerText = matchedStr.slice(2, -2);
                    newNodes.push({
                        type: 'html',
                        value: `<mark class="obsidian-highlight">${innerText}</mark>`
                    });
                } else if (matchedStr.startsWith('![[') && matchedStr.endsWith(']]')) {
                    const innerText = matchedStr.slice(3, -2);
                    const parts = innerText.split('|');
                    const rawTarget = parts[0].trim();
                    // 将来のブロックID対応のため、ここで名前だけ抽出（今回はそのまま使う）
                    const targetName = rawTarget.split(/[/\\]/).pop() || rawTarget;
                    const sizeAttr = parts.length > 1 ? ` width="${parts[1].trim()}"` : ' class="max-w-full h-auto"';

                    // 画像ファイルかどうかの簡易判定
                    const isImage = /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(targetName);
                    
                    if (isImage) {
                        newNodes.push({
                            type: 'html',
                            value: `<img data-img-filename="${targetName}"${sizeAttr} alt="${targetName}" style="border-radius: 4px; display: inline-block; margin: 0.5rem 0; min-height: 40px; min-width: 40px; background-color: var(--active-highlight-bg);" />`
                        });
                    } else {
                        // ノートの場合は、後でDOM操作で中身を入れるためのプレースホルダーを配置
                        newNodes.push({
                            type: 'html',
                            value: `<div class="obsidian-embed-placeholder" data-embed-target="${targetName}"></div>`
                        });
                    }
                } else if (matchedStr.startsWith('[[') && matchedStr.endsWith(']]')) {
                    const innerText = matchedStr.slice(2, -2);
                    const parts = innerText.split('|');
                    const target = parts[0];
                    const displayText = parts[1] || target;
                    newNodes.push({
                        type: 'html',
                        value: `<a href="#" class="obsidian-wiki-link" data-wiki-target="${target}">${displayText}</a>`
                    });
                }
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
                newNodes.push({ type: 'text', value: text.slice(lastIndex) });
            }

            if (newNodes.length > 0) {
                parent.children.splice(index, 1, ...newNodes);
                return index + newNodes.length; // 追加した分だけインデックスを進める
            }
        });
    };
}

/**
 * [AST Plugin] 見出しに折りたたみ用トグルを付与
 */
function remarkHeadings() {
    return (tree: MdastRoot) => {
        visit(tree, 'heading', (node: Heading) => {
            node.children.unshift({
                type: 'html',
                value: '<span class="heading-toggle" title="折りたたみ"></span>'
            } as HTML);
        });
    };
}

/**
 * [AST Plugin] コードブロックのパース（ウィジェットやコピーボタンラッパーの付与）
 */
function remarkCodeBlocks() {
    return (tree: MdastRoot) => {
        visit(tree, 'code', (node: Code, index: number | undefined, parent: Parent | undefined) => {
            if (!parent || index === undefined) return;
            const lang = node.lang || '';

            // ダッシュボードウィジェット判定
            let query = '';
            let sortKey = '';
            let sortOrder = '';
            let isWidget = false;

            if (lang.startsWith('obcowa-search')) {
                const match = lang.match(/obcowa-search\((.*?)\)/);
                query = match ? match[1] : '';
                isWidget = true;
            } else if (lang === 'search') {
                const parsed = parseDataviewQuery(node.value);
                query = parsed.query;
                sortKey = parsed.sortKey;
                sortOrder = parsed.sortOrder;
                isWidget = true;
            }

            if (isWidget) {
                parent.children.splice(index, 1, {
                    type: 'html',
                    value: `<div class="dashboard-widget" data-widget-type="search" data-query="${query}" data-sort-key="${sortKey}" data-sort-order="${sortOrder}"></div>`
                } as HTML);
                return index + 1;
            }

            // 通常のコードブロック
            const matchedLang = lang.match(/\S*/)?.[0] || '';
            const codeContent = node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            parent.children.splice(index, 1, {
                type: 'html',
                value: `
                <div class="code-block-wrapper">
                    <button type="button" class="code-copy-btn" title="コードをコピー">${COPY_ICON_SVG}</button>
                    <pre><code class="language-${matchedLang}">${codeContent}</code></pre>
                </div>
                `
            } as HTML);
            return index + 1;
        });
    };
}

/**
 * [AST Plugin] GFMのタスクリストを既存のCSSに合わせた構造に整形 (Rehype/HASTフェーズ)
 */
function rehypeTaskLists() {
    return (tree: HastRoot) => {
        visit(tree, 'element', (node: HastElement) => {
            if (node.tagName === 'li' && node.properties?.className && Array.isArray(node.properties.className) && node.properties.className.includes('task-list-item')) {
                const inputIndex = node.children.findIndex((c) => c.type === 'element' && c.tagName === 'input' && c.properties?.type === 'checkbox');
                if (inputIndex !== -1) {
                    const inputNode = node.children[inputIndex] as HastElement;
                    if (inputNode.properties) {
                        delete inputNode.properties.disabled;
                        inputNode.properties.className = ['task-checkbox'];
                    }
                    
                    const contentChildren = node.children.slice(inputIndex + 1);
                    const spanNode: HastElement = {
                        type: 'element',
                        tagName: 'span',
                        properties: { className: ['task-content'] },
                        children: contentChildren
                    };
                    node.children = [...node.children.slice(0, inputIndex + 1), spanNode];
                }
            }
        });
    };
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
            'data-widget-type', 'data-query', 'data-wiki-target', 'data-embed-target',
            'style', 'width', 'alt' // ★追加: 画像の表示崩れを防ぐ
        ]
    });
}

/**
 * Markdown文字列をパースしてHTMLに変換するメイン関数
 */
export async function parseMarkdown(content: string, tabPath: string, showProperties: boolean = false): Promise<string> {
    const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkEscapeUserHtml)         // ユーザ起因のタグを無害化(既存仕様維持)
        .use(remarkPropertiesCard, { showProperties })
        .use(remarkGfm)
        .use(remarkObsidianExtensions)
        .use(remarkHeadings)
        .use(remarkCodeBlocks)
        .use(remarkRehype, { allowDangerousHtml: true }) // 生成したHTMLノードを許可
        .use(rehypeRaw)                                  // HTML文字列をHASTに変換
        .use(rehypeTaskLists)                            // タスクリストのDOM構造最適化
        .use(rehypeStringify);

    const vfile = await processor.process(content);
    return String(vfile);

}