// --- START OF src/components/Editor/RightSidebar/outlineUtils.ts ---
export interface OutlineItem {
    level: number;
    text: string;
    lineIndex: number;
    headingIndex: number;
}

export function extractHeadings(markdown: string): OutlineItem[] {
    if (!markdown) return [];

    // \r\n (Windows), \n (Linux/Mac), \r (旧Mac) すべての改行コードに対応
    const lines = markdown.split(/\r\n|\n|\r/);
    const headings: OutlineItem[] = [];
    
    let inCodeBlock = false;
    let headingCount = 0;

    // 事前にコンパイルしておくことで、大量の行でも高速にマッチング
    // ^\s* = 行頭にスペースがあっても許容する
    const headingRegex = /^\s*(#{1,6})\s+(.*)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // コードブロックのトグル (```内の#は見出しとして判定しない)
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        // コードブロックの中とみなされている間はスキップ
        if (inCodeBlock) continue;

        // 見出しの判定
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

    // もしファイルの先頭でコードブロックが誤爆して最後までinCodeBlockがtrueになった場合、
    // セーフティとして「コードブロック無視」で再抽出するなどの拡張も可能ですが、
    // 今回はまず基本の正規表現と改行コードの対応で様子を見ます。

    return headings;
}
// --- END OF src/components/Editor/RightSidebar/outlineUtils.ts ---