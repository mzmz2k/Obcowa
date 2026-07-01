// --- START OF src/lib/library.ts ---
export function cloneNodeAsIndependent(node: any): any {
    if (!node) return node;
    // JSONの性質を利用して、参照を引き継がない完全に独立したデータ（ディープコピー）を作る
    return JSON.parse(JSON.stringify(node));
}
// --- END OF src/lib/library.ts ---