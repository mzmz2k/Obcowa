<!-- サイドバー下部のリスト切り替え・設定ボタン -->

<script lang="ts">
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { SquarePen, Settings, SlidersHorizontal } from 'lucide-svelte';

  // 親から受け取る変数（モーダル開閉フラグなどは双方向バインディングで親と共有します）
  export let workspaces: any[];
  export let currentIndex: number;
  export let editingListIndex: number;
  export let isCreateModalOpen: boolean;
  export let isManageModalOpen: boolean;
  export let openSettings: () => void;

  // メニューの開閉状態はここで自己管理する
  let isSettingsMenuOpen = false;

  // 💥 親ファイルから移動：新しいウィンドウでリストを開く処理
  function changeWorkspace(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedIndex = parseInt(target.value, 10);
    
    // 現在のウィンドウは切り替えず、セレクトボックスの表示を元に戻す
    target.value = currentIndex.toString();
    if (selectedIndex === currentIndex) return;

    // 別のワークスペースを「新しいウィンドウ」として開く
    const label = `ws-${Date.now()}`;
    const webview = new WebviewWindow(label, {
      url: `/?ws=${selectedIndex}`,
      title: workspaces[selectedIndex].name,
      width: 1000,
      height: 800
    });

    webview.once('tauri://error', function (e) {
      console.error('ウィンドウ生成エラー:', e);
      alert('新しいウィンドウを開けませんでした。パーミッション設定を確認してください。');
    });
  }
</script>

<!-- 画面のどこかをクリックしたらメニューを閉じる処理（この部品限定） -->
<svelte:window on:click={() => { isSettingsMenuOpen = false; }} />


<div 
  class="p-2 border-t flex items-center gap-1 relative" 
  style="background-color: var(--menu-bg); border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"
>
  <select 
    class="w-32 text-xs rounded py-1 px-1 outline-none" 
    style="background-color: var(--bg-color); color: var(--text-color); border: none;" 
    value={currentIndex} 
    on:change={changeWorkspace}
  >

    {#each workspaces.map((w, i) => ({...w, originalIndex: i})).filter(w => w.category === 'Active') as ws}
      <option value={ws.originalIndex}>{ws.name}</option>
    {/each}
  </select>
  
  <div class="flex-1"></div>

  <button 
    on:click|stopPropagation={() => isSettingsMenuOpen = !isSettingsMenuOpen} 
    class="flex items-center justify-center w-7 h-7 opacity-70 hover:opacity-100 transition relative z-10"
  >
    <Settings size={16} />
  </button>
  

  {#if isSettingsMenuOpen}
  
    <div 
      class="absolute bottom-10 right-2 border rounded shadow-xl z-50 py-1 w-44 text-sm" 
      style="background-color: var(--menu-bg); color: var(--text-color); border-color: color-mix(in srgb, var(--text-color) 20%, transparent);"
    >
      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; isCreateModalOpen = true; }}>

        <SquarePen size={14} class="mr-2" /> リスト作成
      </button>

      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; editingListIndex = currentIndex; isManageModalOpen = true; }}>

        <SlidersHorizontal size={14} class="mr-2" /> リスト管理
      </button>

      <div class="border-t my-1" style="border-color: color-mix(in srgb, var(--text-color) 10%, transparent);"></div>
      <button class="menu-item" on:click={() => { isSettingsMenuOpen = false; openSettings(); }}>

        <Settings size={14} class="mr-2" /> 設定
      </button>
    </div>
  {/if}
</div>


<style>
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    transition: background-color 0.15s ease;
    color: var(--text-color);
  }

  .menu-item:hover {
    background-color: var(--active-highlight-bg);
  }
</style>