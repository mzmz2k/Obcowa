<!-- --- START OF src/components/StyleSettings.svelte --- -->
<script lang="ts">
    import type { StyleSlot } from '../../features/styleSettings/styleStore';

    export let tempStyle: StyleSlot;
    export let tempCustomSlots: StyleSlot[];
    export let defaultStyle: StyleSlot;

    let editingSlotId = tempStyle.id;

    // スロットの選択が切り替わったときの処理
    function handleSlotChange() {
        if (editingSlotId === 'default') {
            // デフォルトは固定値のためディープコピー
            tempStyle = JSON.parse(JSON.stringify(defaultStyle));
        } else {
            const target = tempCustomSlots.find(s => s.id === editingSlotId);
            if (target) {
                tempStyle = JSON.parse(JSON.stringify(target));
            }
        }
    }

    // プルダウンのIDと、読み込まれたデータのIDが完全に一致している時だけ自動保存する
    // （切り替えの瞬間に誤って上書きしてしまうのを防ぐ）
    $: if (tempStyle.id !== 'default' && tempStyle.id === editingSlotId) {
        const index = tempCustomSlots.findIndex(s => s.id === tempStyle.id);
        if (index !== -1) {
            tempCustomSlots[index] = { ...tempStyle };
        }
    }

    // UI用のH1〜H6の定義配列
    const headings = [
        { label: 'H1', ref: tempStyle.h1 },
        { label: 'H2', ref: tempStyle.h2 },
        { label: 'H3', ref: tempStyle.h3 },
        { label: 'H4', ref: tempStyle.h4 },
        { label: 'H5', ref: tempStyle.h5 },
        { label: 'H6', ref: tempStyle.h6 },
    ];
</script>

<div class="h-full flex flex-col">
    <h2 class="text-lg font-bold mb-4">スタイル設定</h2>

    <!-- スロット選択 -->
    <div class="mb-6 flex gap-4 items-center border-b border-black/10 pb-4">
        <div class="text-sm font-bold opacity-80">適用するスロット:</div>
        <select class="flex-1 bg-black/10 border border-black/20 rounded p-2 text-sm outline-none" style="color: var(--text-color);" bind:value={editingSlotId} on:change={handleSlotChange}>
            <option value="default" style="background: var(--bg-color);">デフォルトスタイル</option>
            {#each tempCustomSlots as slot}
                <option value={slot.id} style="background: var(--bg-color);">{slot.name}</option>
            {/each}
        </select>
    </div>

    <!-- 編集エリア（デフォルト選択時はリードオンリー風にするため半透明化） -->
    <div class="flex-1 overflow-y-auto pr-2 space-y-6 pb-8" class:opacity-50={editingSlotId === 'default'} class:pointer-events-none={editingSlotId === 'default'}>
        
        <!-- エディタ全体の設定 -->
        <div class="bg-black/5 p-4 rounded border border-black/10">
            <div class="text-sm font-bold mb-3">エディタ全体の設定</div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-xs opacity-70 mb-1">フォント名</div>
                    <input type="text" class="w-full bg-black/10 border border-black/20 rounded p-1.5 text-sm outline-none" bind:value={tempStyle.editorFont} placeholder="sans-serif, 'Meiryo'..." />
                </div>
                <div>
                    <div class="text-xs opacity-70 mb-1">フォントサイズ (px)</div>
                    <input type="number" min="8" max="48" class="w-full bg-black/10 border border-black/20 rounded p-1.5 text-sm outline-none" bind:value={tempStyle.editorFontSize} />
                </div>
                <div>
                    <div class="text-xs opacity-70 mb-1">行間 (倍率)</div>
                    <input type="number" step="0.1" min="1.0" max="3.0" class="w-full bg-black/10 border border-black/20 rounded p-1.5 text-sm outline-none" bind:value={tempStyle.lineHeight} />
                </div>
            </div>
        </div>

        <!-- 見出しの設定 -->
        <div class="bg-black/5 p-4 rounded border border-black/10">
            <div class="text-sm font-bold mb-3">見出しのスタイル設定</div>
            
            <div class="flex flex-col gap-2">
                <!-- Svelteのリアクティビティを確実にするため、各要素を直接バインドします -->
                {#each [
                    { label: 'H1', item: tempStyle.h1 },
                    { label: 'H2', item: tempStyle.h2 },
                    { label: 'H3', item: tempStyle.h3 },
                    { label: 'H4', item: tempStyle.h4 },
                    { label: 'H5', item: tempStyle.h5 },
                    { label: 'H6', item: tempStyle.h6 }
                ] as h}
                    <div class="flex items-center gap-3 text-sm py-1 border-b border-black/5 last:border-0 hover:bg-black/5 px-2 rounded">
                        <div class="w-6 font-bold">{h.label}</div>
                        
                        <div class="flex items-center gap-1 w-24">
                            <input type="number" step="0.1" min="0.5" max="5.0" class="w-14 bg-black/10 border border-black/20 rounded px-1 py-1 outline-none text-right" bind:value={h.item.fontSize} />
                            <span class="opacity-60 text-xs">rem</span>
                        </div>

                        <label class="flex items-center gap-1 cursor-pointer ml-2">
                            <input type="checkbox" bind:checked={h.item.borderBottom} />
                            <span>下線</span>
                        </label>

                        <label class="flex items-center gap-1 cursor-pointer ml-2">
                            <input type="checkbox" bind:checked={h.item.bold} />
                            <span>太字</span>
                        </label>

                        <label class="flex items-center gap-1 cursor-pointer ml-2">
                            <input type="checkbox" bind:checked={h.item.italic} />
                            <span>斜体</span>
                        </label>
                    </div>
                {/each}
            </div>
            <div class="text-xs opacity-50 mt-3">※ デフォルトスタイルは編集できません。スロット１〜３を選択して編集してください。</div>
        </div>
    </div>
</div>
<!-- --- END OF src/components/StyleSettings.svelte --- -->