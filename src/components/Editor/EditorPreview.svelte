<!-- --- START OF src/components/Editor/EditorPreview.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { tick, createEventDispatcher } from 'svelte';
  import { editorFont, imageFolderPath } from '../../lib/stores';
  import { generateImageHtml, loadImagesInDom } from '../../lib/editor/imageViewer';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { FileQuestion } from 'lucide-svelte';
  import { 
      toggleTaskMarkdown, 
      copyCodeBlock, 
      toggleHeadingCollapse,
      COPY_ICON_SVG,
      CHECK_ICON_SVG 
  } from '../../features/previewExtensions/previewExtensions';


  const dispatch = createEventDispatcher();

  // Markdownを解析する「直前」に、< だけを無害な文字にすり替える
  const hooks = {
      preprocess(src: string) {
          // これにより、ライブラリがHTMLタグだと勘違いして解析を放棄するのを防ぎます
          // >（引用記号）は置換しないため、Markdownの引用機能は壊れません
          return src.replace(/</g, "&lt;");
      }
  };


  export let activeTab: any;
  // 親(Editor.svelte)にスクロール位置を復元させるための変数をバインド(双方向通信)する
  export let scrollContainer: HTMLDivElement | undefined = undefined;


  //  ==ハイライト== を認識させるための拡張ルール
  const highlightExtension = {
      name: 'highlight',
      level: 'inline',                                 // 行内（インライン）のルールとして定義
      start(src: string) { return src.match(/==/)?.index; }, // どこに == があるか探す
      tokenizer(src: string, tokens: any) {
          const rule = /^==([\s\S]+?)==/;              // == で囲まれた部分を見つける正規表現
          const match = rule.exec(src);
          if (match) {
              return {
                  type: 'highlight',
                  raw: match[0],
                  text: match[1],
                  // ハイライトの中にある太字(**)なども処理できるようにする
                  tokens: this.lexer.inlineTokens(match[1]) 
              };
          }
      },
      renderer(token: any) {
          // <mark> タグに変換して出力
          return `<mark class="obsidian-highlight">${this.parser.parseInline(token.tokens)}</mark>`;
      }
  };

   // Obsidian互換の画像記法（![[...]]）をMarkdownのルールとして認識させる
  const obsidianImageExtension = {
      name: 'obsidianImage',
      level: 'inline',
      start(src: string) { return src.match(/!\[\[/)?.index; },
      tokenizer(src: string, tokens: any) {
          const rule = /^!\[\[([\s\S]+?)\]\]/;
          const match = rule.exec(src);
          if (match) {
              return {
                  type: 'obsidianImage',
                  raw: match[0],
                  filename: match[1]
              };
          }
      },
      renderer(token: any) {
          // コンポーネント内の現在のタブパスを使って画像タグを生成
          return generateImageHtml(token.filename, activeTab?.path || '', $imageFolderPath);
      }
  };


  // marked のレンダラーカスタマイズ
  let taskCounter = 0;


  // marked のレンダラーカスタマイズ
  const customRenderer = {

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

          const matchedLang = lang.match(/\S*/)?.[0] || '';
          const escapedCode = isEscaped ? codeStr : codeStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `
              <div class="code-block-wrapper">
                  <button type="button" class="code-copy-btn" title="コードをコピー">${COPY_ICON_SVG}</button>
                  <pre><code class="language-${matchedLang}">${escapedCode}</code></pre>
              </div>
          `;
      },


      listitem(itemOrText: any, taskArg?: boolean, checkedArg?: boolean) {
          let text = '';
          let isTask = false;
          let isChecked = false;

          if (typeof itemOrText === 'object' && itemOrText !== null) {
              isTask = !!itemOrText.task;
              isChecked = !!itemOrText.checked;
              if (itemOrText.tokens && this.parser) {
                  try {
                      text = this.parser.parse(itemOrText.tokens);
                  } catch (e) {
                      text = itemOrText.text || '';
                  }
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
      extensions: [highlightExtension, obsidianImageExtension],
      renderer: customRenderer
  });

  let fileExists = true;
  let renderedHtml = '';

    // タブの情報が変わるたびに実行される
  $: if (activeTab) {
      checkAndRender(activeTab);
  }

  // DOM上に生成されたすべてのチェックボックスへ上から順に0, 1, 2...とインデックスを付与する
  function assignTaskIndexes() {
      if (!scrollContainer) return;
      const checkboxes = scrollContainer.querySelectorAll<HTMLInputElement>('.task-checkbox');
      checkboxes.forEach((cb, index) => {
          cb.setAttribute('data-task-index', index.toString());
      });
  }

  async function checkAndRender(tab: any) {
      if (tab.path && tab.path !== '__SEARCH__') {
          fileExists = await invoke('check_file_exists', { path: tab.path });
      } else {
          fileExists = true;
      }

      if (fileExists) {
          if (tab.path.endsWith('.txt')) {
              const safeText = tab.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
              renderedHtml = DOMPurify.sanitize(safeText.replace(/\n/g, '<br>'));
          } else {
              const rawHtml = marked(removeFrontmatter(tab.content));
              
              renderedHtml = DOMPurify.sanitize(rawHtml as string, {
                  ADD_TAGS: ['button', 'input'],
                  ADD_ATTR: [
                      'data-img-filename', 'data-primary-dir', 'data-fallback-dir', 'data-cache-key',
                      'data-task-index', 'type', 'checked', 'class'
                  ]
              });
          }
          await tick(); 
          loadImagesInDom(); 
          assignTaskIndexes(); // ★ 追加: DOM構築完了後に確実にインデックスを割り当てる
          
          dispatch('renderComplete'); 
      }
  }

  function removeFrontmatter(content: string) {
      return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }


  async function handlePreviewClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      // 1. タスクチェックボックスのクリックハンドリング
      const taskInput = target.closest<HTMLInputElement>('.task-checkbox');
      if (taskInput) {
          const indexAttr = taskInput.getAttribute('data-task-index');
          if (indexAttr !== null && activeTab) {
              const targetIndex = parseInt(indexAttr, 10);
              const updatedContent = toggleTaskMarkdown(activeTab.content, targetIndex);
              activeTab.content = updatedContent;
              dispatch('contentChange', { path: activeTab.path, content: updatedContent });
          }
          return;
      }

      // 2. コードコピーボタンのクリックハンドリング
      const copyBtn = target.closest<HTMLButtonElement>('.code-copy-btn');
      if (copyBtn) {
          event.preventDefault();
          const success = await copyCodeBlock(copyBtn);
          if (success) {
              copyBtn.innerHTML = CHECK_ICON_SVG;
              setTimeout(() => {
                  copyBtn.innerHTML = COPY_ICON_SVG;
              }, 1500);
          }
          return;
      }

      // 3. 見出しのトグルクリックハンドリング
      const headingEl = target.closest<HTMLElement>('h1, h2, h3, h4, h5, h6');
      if (headingEl && headingEl.closest('.editor-preview')) {
          toggleHeadingCollapse(headingEl);
          return;
      }

      // 4. 既存の外部リンククリックハンドリング
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
          event.preventDefault();
          try { await openUrl(anchor.href); } catch (e) {}
      }
  }
</script>

{#if !fileExists}
  <!-- 💥 追加: ファイルが見つからないときのエラー表示 -->
  <div class="flex-1 flex flex-col items-center justify-center opacity-60 h-full" style="color: var(--text-color);">
      <FileQuestion size={48} class="mb-4 text-red-400" />
      <div class="text-sm">ファイルが存在しません</div>
      <div class="text-xs mt-2 opacity-70">移動または削除された可能性があります</div>
  </div>
{:else}
 <div 
      class="flex-1 overflow-y-auto p-6" 
      bind:this={scrollContainer} 
      style="font-family: var(--editor-font, {$editorFont});"
  >
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="prose max-w-none select-text cursor-text editor-preview" style="color: var(--text-color);" on:click={handlePreviewClick}>
          {@html renderedHtml}
      </div>
  </div>
{/if}
<!-- --- END OF src/components/Editor/EditorPreview.svelte --- -->