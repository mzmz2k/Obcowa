// 検索結果配列を副作用なく並び替える純粋関数
export function sortSearchResults(results: any[], key: string, order: string) {
    return [...results].sort((a, b) => {
        let valA, valB;
        if (key === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else if (key === 'created') {
            valA = a.created_at || 0;
            valB = b.created_at || 0;
        } else {
            valA = a.updated_at || 0;
            valB = b.updated_at || 0;
        }
        
        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
}