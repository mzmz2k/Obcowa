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

marked.use({ breaks: true, hooks, extensions: [highlightExtension, obsidianImageExtension] });

  let fileExists = true;
  let renderedHtml = '';

  // タブの情報が変わるたびに実行される
  $: if (activeTab) {
      checkAndRender(activeTab);
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
              // parseObsidianImages の事前置換をやめる（markedが自動でタグを作ってくれるため）
              const rawHtml = marked(removeFrontmatter(tab.content));
              
              // DOMPurifyに、自作画像ビューワーで使っている特別なデータ属性を「消さないで」とお願いする
              renderedHtml = DOMPurify.sanitize(rawHtml as string, {
                  ADD_ATTR: ['data-img-filename', 'data-primary-dir', 'data-fallback-dir', 'data-cache-key']
              });
          }
          await tick(); 
          loadImagesInDom(); 
          
          dispatch('renderComplete'); 
      }
  }

  function removeFrontmatter(content: string) {
      return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }


  async function handlePreviewClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
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