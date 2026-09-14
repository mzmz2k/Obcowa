// 責務: Markdownから見出しを抽出する純粋関数
export interface OutlineItem {
    level: number;
    text: string;
    lineIndex: number;
    headingIndex: number;
}

export function extractHeadings(markdown: string): OutlineItem[] {
    const lines = markdown.split('\n');
    const headings: OutlineItem[] = [];
    let inCodeBlock = false;
    let headingCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // コードブロックのトグル (```内の#は見出しとして判定しない)
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) continue;

        // 見出しの判定 (行頭が # で始まり、スペースが続く)
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
            headings.push({
                level: match[1].length,
                text: match[2].trim(),
                lineIndex: i,
                headingIndex: headingCount
            });
            headingCount++;
        }
    }

    return headings;
}
// --- END OF src/components/Editor/RightSidebar/outlineUtils.ts ---