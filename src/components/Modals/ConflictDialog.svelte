<!-- 責務：ファイル競合時にローカルとリモートの差分を表示し、「上書き」「再読み込み」「保留」を選択させるダイアログ -->
<script lang="ts">
    import { computeSideBySideDiff, type DiffBlock } from '../../lib/editor/diffUtils';

    export let isOpen = false;
    export let filePath = "";
    export let localContent = "";
    export let remoteContent = "";
    export let onResolve: ((resolution: 'overwrite' | 'reload' | 'cancel') => void) | null = null;

    let isCalculating = false;
    let diffBlocks: DiffBlock[] = [];

    // ダイアログが開かれた時、UIのフリーズを防ぐため少し遅らせてからDiffを計算する
    $: if (isOpen) {
        isCalculating = true;
        diffBlocks = [];
        setTimeout(() => {
            diffBlocks = computeSideBySideDiff(remoteContent, localContent);
            isCalculating = false;
        }, 50);
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="bg-[var(--bg-color)] border border-[var(--menu-bg)] rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            
            <div class="p-6 pb-4 border-b border-[var(--menu-bg)] shrink-0">
                <h2 class="text-xl font-bold text-[var(--text-color)] mb-2">ファイルの競合が検出されました</h2>
                <p class="text-sm text-[var(--text-color)] opacity-80">
                    "{filePath.split(/[\/\\]/).pop() || filePath}" は外部で変更されています。以下で差分を確認し、保存方法を選択してください。
                </p>
            </div>
            
            <!-- 差分表示エリア（スクロール可能） -->
            <div class="flex-1 overflow-auto p-4 bg-[var(--menu-bg)]">
                {#if isCalculating}
                    <div class="flex items-center justify-center h-full text-[var(--text-color)] opacity-70">
                        差分を計算中...
                    </div>
                {:else}
                    <div class="flex border-b border-[var(--bg-color)] sticky top-0 z-10 bg-[var(--menu-bg)] pb-2 mb-2 text-sm font-bold text-[var(--text-color)] opacity-80">
                        <div class="flex-1 px-4 border-r border-[var(--bg-color)]">外部の最新ファイル</div>
                        <div class="flex-1 px-4">現在のエディタの内容</div>
                    </div>
                    
                    <div class="flex flex-col font-mono text-sm">
                        {#each diffBlocks as block (block.id)}
                            {#if !block.isChange}
                                <!-- 変更なしブロック -->
                                <div class="flex text-[var(--text-color)] opacity-60 hover:opacity-100 transition-opacity">
                                    <div class="flex-1 px-4 py-1 border-r border-[var(--bg-color)] whitespace-pre-wrap break-all">
                                        {#each block.remoteLines as line}{line}<br/>{/each}
                                    </div>
                                    <div class="flex-1 px-4 py-1 whitespace-pre-wrap break-all">
                                        {#each block.localLines as line}{line}<br/>{/each}
                                    </div>
                                </div>
                            {:else}
                                <!-- 変更ありブロック（将来ここに採用ボタンを追加可能） -->
                                <div class="flex my-2 rounded border border-[var(--active-highlight-bg)] overflow-hidden">
                                    <div class="flex-1 px-4 py-2 border-r border-[var(--active-highlight-bg)] whitespace-pre-wrap break-all" 
                                         style="background-color: color-mix(in srgb, var(--text-color) 10%, transparent);">
                                        {#each block.remoteLines as line}
                                            <div class="line-through opacity-80">{line || '\u00A0'}</div>
                                        {/each}
                                    </div>
                                    <div class="flex-1 px-4 py-2 whitespace-pre-wrap break-all" 
                                         style="background-color: color-mix(in srgb, var(--accent-color) 15%, transparent);">
                                        {#each block.localLines as line}
                                            <div>{line || '\u00A0'}</div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- アクションボタンエリア -->
            <div class="p-6 pt-4 border-t border-[var(--menu-bg)] flex justify-end gap-3 shrink-0 bg-[var(--bg-color)] rounded-b-lg">

                <!-- 1. 外部データで上書き（うっすら赤） -->
                <button class="px-4 py-2 rounded text-[var(--text-color)] transition-opacity hover:opacity-80"
                        style="background-color: color-mix(in srgb, var(--bg-color) 85%, #ef4444); border: 1px solid color-mix(in srgb, var(--bg-color) 70%, #ef4444);"
                        on:click={() => onResolve?.('reload')}>
                    外部データで上書き
                </button>

                <!-- 2. エディタの内容で強制上書き（うっすら緑） -->
                <button class="px-4 py-2 rounded text-[var(--text-color)] font-bold transition-opacity hover:opacity-80"
                        style="background-color: color-mix(in srgb, var(--bg-color) 85%, #22c55e); border: 1px solid color-mix(in srgb, var(--bg-color) 70%, #22c55e);"
                        on:click={() => onResolve?.('overwrite')}>
                    エディタの内容で強制上書き
                </button>

                <!-- 3. 保留（色なしベース） -->
                <button class="px-4 py-2 rounded text-[var(--text-color)] bg-[var(--menu-bg)] hover:bg-[var(--active-highlight-bg)] transition-colors"
                        on:click={() => onResolve?.('cancel')}>
                    保留（あとで決める）
                </button>

            </div>

        </div>
    </div>
{/if}