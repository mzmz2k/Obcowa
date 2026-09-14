// 責務: Markdownから見出しを抽出する純粋関数
// --- START OF src/components/Editor/RightSidebar/outlineUtils.ts ---
export interface OutlineItem {
    level: number;
    text: string;
    lineIndex: number;
    headingIndex: number;
}

export function extractHeadings(markdown: string): OutlineItem[] {
    if (!markdown) return [];

    const lines = markdown.split(/\r\n|\n|\r/);
    const headings: OutlineItem[] = [];
    
    let inCodeBlock = false;
    let headingCount = 0;
    const headingRegex = /^\s*(#{1,6})\s+(.*)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) continue;

        const match = line.match(headingRegex);
        if (match) {
            const text = match[2].trim();
            if (text) {
                headings.push({
                    level: match[1].length,
                    text: text,
                    lineIndex: i,
                    headingIndex: headingCount
                });
                headingCount++;
            }
        }
    }
    return headings;
}

// 🔽 追加：折りたたみ状態を考慮して、画面に表示すべき見出しだけを抽出する純粋関数
export function getVisibleHeadings(headings: OutlineItem[], collapsedIndices: Set<number>): OutlineItem[] {
    const result: OutlineItem[] = [];
    let hideThresholdLevel = Infinity;

    for (const h of headings) {
        // 現在の見出しレベルが閾値（折りたたんだ見出しのレベル）以下になったら、非表示モードを解除する
        if (h.level <= hideThresholdLevel) {
            hideThresholdLevel = Infinity;
        }

        // 非表示モード中であれば、この見出しはスキップ（隠す）
        if (hideThresholdLevel !== Infinity) {
            continue;
        }

        // 自身が折りたたまれている場合、自分より深いレベルの見出しを隠すように閾値をセット
        if (collapsedIndices.has(h.headingIndex)) {
            hideThresholdLevel = h.level;
        }

        // 自身は結果に含める
        result.push(h);
    }

    return result;
}

// 🔽 追加：その見出しが子要素（自分より深い直後の見出し）を持っているか判定する関数
export function hasChildHeading(headings: OutlineItem[], index: number): boolean {
    if (index >= headings.length - 1) return false;
    // 次の見出しが、自分よりレベルの値が大きい（深い階層である）場合は子要素あり
    return headings[index + 1].level > headings[index].level;
}
// --- END OF src/components/Editor/RightSidebar/outlineUtils.ts ---