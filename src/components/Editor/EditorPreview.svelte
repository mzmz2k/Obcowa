<!-- Markdownを綺麗に表示し、ユーザーがクリックしたイベントを外に教える -->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { tick, createEventDispatcher, onDestroy } from 'svelte';
  import { editorFont } from '../../lib/stores';
  import { loadImagesInDom } from '../../lib/editor/imageViewer';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { FileQuestion } from 'lucide-svelte';
  import { toggleTaskMarkdown, copyCodeBlock, toggleHeadingCollapse, COPY_ICON_SVG, CHECK_ICON_SVG } from './previewExtensions';
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
              const rawHtml = parseMarkdown(tab.content, tab.path || '');
              renderedHtml = sanitizeHtml(rawHtml);
          }
          
          await tick(); 
          loadImagesInDom(); 
          assignTaskIndexes();
          
          if (tab.isDashboard && scrollContainer) {
              mountWidgets(scrollContainer);
          }
          dispatch('renderComplete'); 
      }
  }

  async function handlePreviewClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

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