// 外部ファイルとローカルエディタ間のテキスト差分を計算し、Side-by-side表示用のブロック配列を生成する
import * as Diff from 'diff';

export interface DiffBlock {
    id: string;          // ブロックの一意なID
    isChange: boolean;   // 変更があったブロックかどうか（将来の「採用」ボタンの表示判定に使う）
    remoteLines: string[]; // 左側（外部の最新データ）の行配列
    localLines: string[];  // 右側（現在のエディタ）の行配列
}

/**
 * 2つのテキストを比較し、Side-by-side（左右分割）で描画しやすいブロック単位に変換する
 */
export function computeSideBySideDiff(remoteText: string, localText: string): DiffBlock[] {
    const diffResults = Diff.diffLines(remoteText, localText);
    const blocks: DiffBlock[] = [];

    let currentChangeBlock: DiffBlock | null = null;
    let idCounter = 0;

    const pushChangeBlock = () => {
        if (currentChangeBlock) {
            blocks.push(currentChangeBlock);
            currentChangeBlock = null;
        }
    };

    diffResults.forEach((part) => {
        const lines = part.value.replace(/\n$/, '').split('\n');

        if (!part.added && !part.removed) {
            pushChangeBlock();
            // 変更がない共通部分
            blocks.push({
                id: `block-${idCounter++}`,
                isChange: false,
                remoteLines: [...lines],
                localLines: [...lines]
            });
        } else {
            // 変更がある部分は1つのブロックにまとめる
            if (!currentChangeBlock) {
                currentChangeBlock = {
                    id: `block-${idCounter++}`,
                    isChange: true,
                    remoteLines: [],
                    localLines: []
                };
            }
            if (part.removed) {
                currentChangeBlock.remoteLines.push(...lines);
            }
            if (part.added) {
                currentChangeBlock.localLines.push(...lines);
            }
        }
    });

    pushChangeBlock();
    return blocks;
}