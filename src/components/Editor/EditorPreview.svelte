<!-- ユーザーがクリックしたイベントを外に教える　マークダウンのHTML変換を受け取り描画する -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { tick, createEventDispatcher, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { editorFont, workspacesStore, currentWorkspaceIndex } from '../../lib/stores';
  import { loadImagesInDom } from '../../lib/editor/imageViewer';
  import { loadEmbedsInDom } from '../../lib/editor/embedViewer';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { FileQuestion } from 'lucide-svelte';
  import { toggleTaskMarkdown, copyCodeBlock, toggleHeadingCollapse, handleWikiLinkClick, COPY_ICON_SVG, CHECK_ICON_SVG } from './previewExtensions';
  import { mountWidgets, unmountAllWidgets } from '../../features/Dashboard/DashboardManager';
  import { parseMarkdown, sanitizeHtml } from './markdownSetup';
  import DOMPurify from 'dompurify'; // .txt用のシンプルなサニタイズ用に残す
  import { isSpecialPath } from '../../lib/utils/pathUtils';

  const dispatch = createEventDispatcher();

  export let activeTab: any;
  export let scrollContainer: HTMLDivElement | undefined = undefined;

  let fileExists = true;
  let renderedHtml = '';

  $: if (activeTab) {
      checkAndRender(activeTab);
  }

  onDestroy(() => {
      unmountAllWidgets();
  });

  function assignTaskIndexes() {
      if (!scrollContainer) return;
      const checkboxes = scrollContainer.querySelectorAll<HTMLInputElement>('.task-checkbox');
      checkboxes.forEach((cb, index) => {
          cb.setAttribute('data-task-index', index.toString());
      });
  }

  async function checkAndRender(tab: any) {
      unmountAllWidgets();

      if (tab.path && !isSpecialPath(tab.path)) {
            fileExists = await invoke('check_file_exists', { path: tab.path });
      } else {
          fileExists = true;
      }

      if (fileExists) {
          if (tab.path && tab.path.endsWith('.txt')) {
              const safeText = tab.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
              renderedHtml = DOMPurify.sanitize(safeText.replace(/\n/g, '<br>'));
          } else {

              // ★変更: markdownSetup に切り出した純粋関数を呼び出すだけ！
              const currentWs = get(workspacesStore)[get(currentWorkspaceIndex)];
              const showProps = currentWs?.show_properties ?? false;
              const rawHtml = await parseMarkdown(tab.content, tab.path || '', showProps);
              renderedHtml = sanitizeHtml(rawHtml);
          }
          
          await tick(); 
          
          if (scrollContainer) {
              const currentWs = get(workspacesStore)[get(currentWorkspaceIndex)];
              const folders = currentWs?.image_folders || [];
              loadImagesInDom(scrollContainer, tab.path || '', folders);
              // ★ ノートの埋め込み処理を発火（画面描画をブロックしないように await はしない）
              loadEmbedsInDom(scrollContainer, tab.path || '');
          }
          assignTaskIndexes();
          
          if (tab.isDashboard && scrollContainer) {
              mountWidgets(scrollContainer);
          }
          dispatch('renderComplete'); 
      }
  }

  async function handlePreviewClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

        // Wikiリンクのクリック検知
        const wikiLinkEl = target.closest('.obsidian-wiki-link') as HTMLElement | null;
        if (wikiLinkEl) {
            event.preventDefault();
            handleWikiLinkClick(wikiLinkEl);
            return;
        }

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

      const copyBtn = target.closest<HTMLButtonElement>('.code-copy-btn');
      if (copyBtn) {
          event.preventDefault();
          const success = await copyCodeBlock(copyBtn);
          if (success) {
              copyBtn.innerHTML = CHECK_ICON_SVG;
              setTimeout(() => { copyBtn.innerHTML = COPY_ICON_SVG; }, 1500);
          }
          return;
      }
      
      // ★追加: プロパティカードの折りたたみ
      const propHeader = target.closest<HTMLElement>('.obsidian-properties-header');
      if (propHeader) {
          const card = propHeader.closest<HTMLElement>('.obsidian-properties-card');
          if (card) card.classList.toggle('is-collapsed');
          return;
      }

      const headingToggle = target.closest<HTMLElement>('.heading-toggle');
      if (headingToggle) {
          const headingEl = headingToggle.closest<HTMLElement>('h1, h2, h3, h4, h5, h6');
          if (headingEl) toggleHeadingCollapse(headingEl);
          return;
      }

      const anchor = target.closest('a');
      if (anchor && anchor.href) {
          event.preventDefault();
          try { await openUrl(anchor.href); } catch (e) {}
      }
  }
  
    export function scrollToHeading(headingIndex: number) {
      if (!scrollContainer) return;
      // h1~h6要素をすべて取得
      const headings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings && headings[headingIndex]) {
          headings[headingIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
  }
</script>

{#if !fileExists}
  <div class="flex-1 flex flex-col items-center justify-center opacity-60 h-full" style="color: var(--text-color);">
      <FileQuestion size={48} class="mb-4 text-red-400" />
      <div class="text-sm">ファイルが存在しません</div>
      <div class="text-xs mt-2 opacity-70">移動または削除された可能性があります</div>
  </div>
{:else}
  <div class="flex-1 overflow-y-auto p-6" bind:this={scrollContainer} style="font-family: var(--editor-font, {$editorFont});">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="prose max-w-none select-text cursor-text editor-preview" style="color: var(--text-color);" on:click={handlePreviewClick}>
          {@html renderedHtml}
      </div>
  </div>
{/if}