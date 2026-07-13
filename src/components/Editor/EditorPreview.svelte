<!-- --- START OF src/components/Editor/EditorPreview.svelte --- -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { marked } from 'marked';
  import { tick, createEventDispatcher } from 'svelte';
  import { editorFont, imageFolderPath } from '../../lib/stores';
  import { generateImageHtml, loadImagesInDom } from '../../lib/editor/imageViewer';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { FileQuestion } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  export let activeTab: any;
  // 親(Editor.svelte)にスクロール位置を復元させるための変数をバインド(双方向通信)する
  export let scrollContainer: HTMLDivElement | undefined = undefined;

  // 生のHTMLタグをただの文字列（テキスト）としてエスケープする設定
  const renderer = {
      html(token: any) {
          // < と > を無害な文字実体参照に変換して出力する
          return token.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
  };

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

  // 💥 変更: renderer と extensions を両方とも適用する
  marked.use({ breaks: true, renderer, extensions: [highlightExtension] });

  let fileExists = true;
  let renderedHtml = '';

  // タブの情報が変わるたびに実行される
  $: if (activeTab) {
      checkAndRender(activeTab);
  }

  async function checkAndRender(tab: any) {
      // 💥 存在確認: 新規作成タブや検索タブ以外なら、Rustに聞いてみる
      if (tab.path && tab.path !== '__SEARCH__') {
          fileExists = await invoke('check_file_exists', { path: tab.path });
      } else {
          fileExists = true;
      }

      if (fileExists) {
          if (tab.path.endsWith('.txt')) {
              const safeText = tab.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
              renderedHtml = safeText.replace(/\n/g, '<br>');
          } else {
              renderedHtml = marked(parseObsidianImages(removeFrontmatter(tab.content), tab.path));
          }
          await tick(); // 画面の描画更新を待つ
          loadImagesInDom(); // 画像を読み込む

          dispatch('renderComplete'); // HTMLの描画が終わったことを親に知らせる
      }
  }

  function removeFrontmatter(content: string) {
      return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  function parseObsidianImages(content: string, tabPath: string) {
      return content.replace(/!\[\[(.*?)\]\]/g, (match, filename) => {
          return generateImageHtml(filename, tabPath, $imageFolderPath);
      });
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
      style="font-family: {$editorFont};"
  >
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="prose max-w-none select-text cursor-text editor-preview" style="color: var(--text-color);" on:click={handlePreviewClick}>
          {@html renderedHtml}
      </div>
  </div>
{/if}
<!-- --- END OF src/components/Editor/EditorPreview.svelte --- -->