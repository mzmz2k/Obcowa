<!-- ファイル競合時に「上書き」「再読み込み」「保留」を選択させるダイアログ -->
<script lang="ts">
    export let isOpen = false;
    export let filePath = "";
    export let onResolve: ((resolution: 'overwrite' | 'reload' | 'cancel') => void) | null = null;
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-[var(--bg-color)] border border-[var(--menu-bg)] rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 class="text-lg font-bold text-[var(--text-color)] mb-4">ファイルの競合</h2>
            <p class="text-sm text-[var(--text-color)] mb-6 opacity-80">
                ファイル "{filePath.split(/[\/\\]/).pop() || filePath}" は他のアプリによって外部で変更されています。どのように処理しますか？
            </p>
            
            <div class="flex flex-col gap-3">
                <button 
                    class="px-4 py-3 text-left rounded bg-[var(--menu-bg)] text-[var(--text-color)] hover:bg-[var(--active-highlight-bg)] transition-colors"
                    on:click={() => onResolve?.('reload')}
                >
                    <div class="font-bold">外部ファイルの内容で上書き（再読み込み）</div>
                    <div class="text-xs opacity-70 mt-1">エディタの変更を破棄し、最新の外部ファイルを読み込みます。</div>
                </button>
                
                <button 
                    class="px-4 py-3 text-left rounded bg-[var(--menu-bg)] text-[var(--text-color)] hover:bg-[var(--active-highlight-bg)] transition-colors"
                    on:click={() => onResolve?.('overwrite')}
                >
                    <div class="font-bold">編集した内容で強制上書き</div>
                    <div class="text-xs opacity-70 mt-1">外部での変更を破棄し、現在のエディタの内容を保存します。</div>
                </button>

                <button 
                    class="px-4 py-3 text-left rounded bg-[var(--menu-bg)] text-[var(--text-color)] hover:bg-[var(--active-highlight-bg)] transition-colors"
                    on:click={() => onResolve?.('cancel')}
                >
                    <div class="font-bold">保留</div>
                    <div class="text-xs opacity-70 mt-1">一時的に未保存状態のまま維持します。</div>
                </button>
            </div>
        </div>
    </div>
{/if}