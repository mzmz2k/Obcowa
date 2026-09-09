// mooを用いてDataview風構文を安全にパースする
import * as moo from 'moo';

const lexer = moo.compile({
    space: { match: /[ \t\n]+/, lineBreaks: true },
    command: ['WHERE', 'SORT'],
    order: ['DESC', 'ASC', 'desc', 'asc'],
    property: ['file.ctime', 'file.mtime', 'file.name'],
    // それ以外の文字（タグや検索ワード）はひとまとめに取得
    text: { match: /[^\s]+/, lineBreaks: false },
});

export function parseDataviewQuery(rawQuery: string) {
    lexer.reset(rawQuery);
    let query = '';
    let sortKey = 'updated';
    let sortOrder = 'desc';

    let currentCommand = '';

    for (let token of lexer) {
        if (token.type === 'space') continue;
        
        if (token.type === 'command') {
            currentCommand = token.value.toUpperCase();
            continue;
        }

        if (currentCommand === 'WHERE') {
            query += (query ? ' ' : '') + token.value;
        } else if (currentCommand === 'SORT') {
            if (token.type === 'property') {
                if (token.value === 'file.ctime') sortKey = 'created';
                else if (token.value === 'file.mtime') sortKey = 'updated';
                else if (token.value === 'file.name') sortKey = 'name';
            } else if (token.type === 'order') {
                sortOrder = token.value.toLowerCase();
            }
        }
    }
    return { query, sortKey, sortOrder };
}