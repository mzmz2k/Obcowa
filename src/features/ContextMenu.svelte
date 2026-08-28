<!-- 右クリックメニューのUI。画面外をクリックしたら自動で閉じる -->
<script lang="ts">
  import type { MenuItem } from '../lib/workspace/menuUtils';
  import { ChevronRight, ChevronLeft } from 'lucide-svelte';

  export let x: number;
  export let y: number;
  export let items: MenuItem[];
  export let openSubLeft: boolean = false; // 💥 右端対策：サブメニューを左に開くか
  export let onClose: () => void;

  function handleClick(e: MouseEvent, item: MenuItem) {
    e.stopPropagation();
    if (item.disabled) return;
    if (item.action) {
      item.action();
    }
    // アクション実行後はメニューを閉じる
    onClose();
  }
</script>

<svelte:window on:click={onClose} />

<div 
  class="fixed border border-black/20 rounded shadow-xl z-50 py-1 w-48"
  style="left: {x}px; top: {y}px; background-color: var(--menu-bg); color: var(--text-color);"
  on:contextmenu|preventDefault
>
  {#each items as item}
    {#if item.divider}
      <hr class="border-black/10 my-1">
    {:else if item.submenu}
      <div class="relative group/submenu">
        <!-- サブメニュー親項目 -->
        <button 
          class="block w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition flex justify-between items-center"
          on:click={(e) => e.stopPropagation()}
        >
          <span class="flex items-center">
            {#if item.icon}<svelte:component this={item.icon} size={14} class="mr-2" />{/if}
            {item.label}
          </span>
          <svelte:component this={openSubLeft ? ChevronLeft : ChevronRight} size={14} />
        </button>
        <!-- サブメニュー展開部分 -->
        <!-- 💥 w-48 を min-w-[12rem] w-max に変更し、中身に合わせて横幅が広がるようにする -->
        <div class="absolute {openSubLeft ? 'right-full -mr-1' : 'left-full -ml-1'} top-0 hidden group-hover/submenu:block border border-black/20 rounded shadow-xl py-1 min-w-[12rem] w-max" style="background-color: var(--menu-bg);">
          {#each item.submenu as subItem}
            {#if subItem.divider}
              <hr class="border-black/10 my-1">
            {:else}
              <button 
                class="block w-full text-left px-4 py-1.5 text-sm hover:bg-black/10 whitespace-nowrap
                       {subItem.danger ? 'text-red-400' : ''} 
                       {subItem.disabled ? 'opacity-50 cursor-default' : ''}
                       {subItem.bold ? 'font-bold' : ''}"
                style="{subItem.accent ? 'color: var(--accent-color);' : ''}"
                on:click={(e) => handleClick(e, subItem)}
              >
                <span class="flex items-center">
                  {#if subItem.checked !== undefined}
                    <span class="inline-block w-4">{subItem.checked ? '✓' : ''}</span>
                  {/if}
                  {#if subItem.icon}<svelte:component this={subItem.icon} size={14} class="mr-2" />{/if}
                  {subItem.label}
                </span>
              </button>
            {/if}
          {/each}
        </div>
      </div>
    {:else}
      <!-- 通常のメニュー項目 -->
      <button 
        class="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-black/10 transition
               {item.danger ? 'text-red-400' : ''}
               {item.bold ? 'font-bold' : ''}"
        style="{item.accent ? 'color: var(--accent-color);' : ''}"
        on:click={(e) => handleClick(e, item)}
      >
        {#if item.icon}<svelte:component this={item.icon} size={14} class="mr-2" />{/if}
        {item.label}
      </button>
    {/if}
  {/each}
</div>