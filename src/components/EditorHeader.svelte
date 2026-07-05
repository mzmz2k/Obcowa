
<script lang="ts">
  import { BookOpen, Pencil } from 'lucide-svelte';

  export let activeTab: any;
  export let toggleEditMode: () => void;

  let copied = false;
  let copyTimeout: ReturnType<typeof setTimeout>;

  // 💥 右クリックでパスをコピーする関数
  async function copyPath(e: MouseEvent) {
    e.preventDefault(); // デフォルトの右クリックメニュー（ブラウザ標準機能）が出るのを防ぐ
    if (!activeTab || !activeTab.path) return;
    
    try {
      await navigator.clipboard.writeText(activeTab.path);
      copied = true;
      
      // 2秒後に元の表示に戻す
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('コピーに失敗しました', err);
    }
  }
</script>

<div class="flex items-center justify-between px-4 py-2 shrink-0 group transition-colors" style="background-color: var(--bg-color); color: var(--text-color);">
  
  <!-- 左寄せ：ファイル名 -->
  <div class="flex-1 truncate text-sm opacity-70" title={activeTab.title}>
    {activeTab.title}
  </div>

  <!-- 中央寄せ：パス（ホバー時に表示） -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- 💥 on:contextmenu を追加し、カーソルを指マーク(cursor-pointer)に変更 -->
  <div 
    class="flex-[2] text-center truncate text-xs opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity px-4 cursor-pointer select-none" 
    title="右クリックでパスをコピー"
    on:contextmenu={copyPath}
  >
    {#if copied}
      <span class="font-bold opacity-60">パスをコピーしました</span>
    {:else}
      {activeTab.path}
    {/if}
  </div>

  <!-- 右寄せ：編集・ビュー切り替えボタン -->
  <div class="flex-1 flex justify-end">
    <button 
        class="w-8 h-8 flex items-center justify-center rounded transition opacity-100 hover:opacity-60"
        on:click={toggleEditMode}
        title={activeTab.isEditing ? 'プレビューモードへ' : '編集モードへ'}
    >
        {#if activeTab.isEditing}
            <BookOpen size={16} />
        {:else}
            <Pencil size={16} />
        {/if}
    </button>
  </div>

</div>