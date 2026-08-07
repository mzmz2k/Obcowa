//タグの文字列処理など（純粋関数）

/**
 * ファイルのテキスト内容からタグを抽出する純粋関数
 */
export function extractTags(content: string): string[] {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const tags: string[] = [];
  
  if (match) {
    const lines = match[1].split(/\r?\n/);
    let inTags = false;
    
    for (const line of lines) {
      if (line.startsWith('tags:') || line.startsWith('tag:')) {
        inTags = true;
        // tags: [A, B] のようなインライン形式も拾う
        const inlineStr = line.substring(line.indexOf(':') + 1).trim();
        if (inlineStr) {
          tags.push(...inlineStr.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(t => t));
          inTags = false; 
        }
        continue;
      }
      
      // リスト形式（- A）を拾う
      if (inTags) {
        if (line.trim().startsWith('- ')) {
          tags.push(line.trim().substring(2).trim());
        } else if (line.trim() !== '' && !line.startsWith(' ')) {
          inTags = false; // 次のプロパティが始まったらタグブロック終了
        }
      }
    }
  }
  return [...new Set(tags)]; // 重複を排除して返す
}

/**
 * ファイルのテキスト内容のタグを書き換える純粋関数（常にリスト形式で整形）
 */
export function updateTagsInContent(content: string, tag: string, isAdd: boolean): string {
  let tags = extractTags(content);
  
  // 変更の必要がなければ元のテキストをそのまま返す
  if (isAdd && tags.includes(tag)) return content;
  if (!isAdd && !tags.includes(tag)) return content;

  if (isAdd) {
    tags.push(tag);
  } else {
    tags = tags.filter(t => t !== tag);
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const fm = match[1];
    const newFmLines: string[] = [];
    const lines = fm.split(/\r?\n/);
    let inTagsBlock = false;
    let hasTags = false;

    for (const line of lines) {
      // タグの記述を見つけたら、新しいリスト形式で展開して書き換える
      if (line.startsWith('tags:') || line.startsWith('tag:')) {
        inTagsBlock = true;
        hasTags = true;
        if (tags.length > 0) {
          newFmLines.push(`tags:`);
          tags.forEach(t => newFmLines.push(`  - ${t}`));
        }
        continue;
      }
      
      // 古いタグの記述行はスキップ（消去）する
      if (inTagsBlock) {
        if (line.trim().startsWith('- ') || line.trim() === '') {
          continue;
        } else if (!line.startsWith(' ') && line.includes(':')) {
          inTagsBlock = false; 
        }
      }
      
      if (!inTagsBlock) newFmLines.push(line);
    }

    // プロパティ自体はあるが tags が無かった場合
    if (!hasTags && tags.length > 0) {
      newFmLines.push(`tags:`);
      tags.forEach(t => newFmLines.push(`  - ${t}`));
    }

    return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---\n${newFmLines.join('\n')}\n---`);
  } else {
    // プロパティが存在しない場合は先頭に作成する
    if (tags.length > 0) {
      const tagsYaml = `tags:\n` + tags.map(t => `  - ${t}`).join('\n');
      return `---\n${tagsYaml}\n---\n\n${content}`;
    }
  }
  
  return content;
}