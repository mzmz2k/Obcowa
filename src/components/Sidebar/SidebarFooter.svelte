<!-- サイドバー下部のリスト切り替え・設定ボタン -->

<script lang="ts">
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { Menu, SquarePen, Settings, Library } from 'lucide-svelte';

  // 親から受け取る変数（モーダル開閉フラグなどは双方向バインディングで親と共有します）
  export let workspaces: any[];
  export let currentIndex: number;
  export let editingListIndex: number;
  export let isCreateModalOpen: boolean;
  export let isManageModalOpen: boolean;
  export let isImportLibraryModalOpen: boolean;
  export let openSettings: () => void;

  // メニューの開閉状態はここで自己管理する
  let isListMenuOpen = false;

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
<svelte:window on:click={() => { isListMenuOpen = false; }} />

<div class="p-2 border-t border-black/10 flex items-center gap-1 relative" style="background-color: var(--menu-bg);">
  <select class="w-32 text-xs rounded py-1 px-1 outline-none border border-black/20" style="background-color: var(--bg-color); color: var(--text-color);" value={currentIndex} on:change={changeWorkspace}>
    {#each workspaces.map((w, i) => ({...w, originalIndex: i})).filter(w => w.category === 'Active') as ws}
      <option value={ws.originalIndex}>{ws.name}</option>
    {/each}
  </select>
  
  <button on:click|stopPropagation={() => isListMenuOpen = !isListMenuOpen} class="flex items-center justify-center w-7 h-7 hover:opacity-70 rounded transition"><Menu size={16} /></button>

  {#if isListMenuOpen}
    <div class="absolute bottom-10 left-36 border border-black/20 rounded shadow-xl z-50 py-1 w-48 text-sm" style="background-color: var(--menu-bg); color: var(--text-color);">
      <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; isCreateModalOpen = true; }}><SquarePen size={14} class="mr-2" /> リスト作成</button>
      <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; editingListIndex = currentIndex; isManageModalOpen = true; }}><Settings size={14} class="mr-2" /> リスト管理</button>
      <hr class="border-black/10 my-1">
      <button class="flex items-center w-full text-left px-4 py-2 hover:bg-black/10 transition" on:click={() => { isListMenuOpen = false; isImportLibraryModalOpen = true; }}><Library size={14} class="mr-2" /> ライブラリを追加</button>
    </div>
  {/if}
  <div class="flex-1"></div>
  <button 
    on:click|stopPropagation={openSettings} 
    class="flex items-center justify-center w-7 h-7 opacity-70 hover:opacity-100 transition relative z-10"
  >
    <Settings size={16} />
  </button>
</div>