// 右クリックメニューを表示するデータ構造を定義し、ファイル共通のアクションを生成
import { Tag, Pin, PinOff, Search, Pencil, FileText, ArrowUpDown, ExternalLink, Layers } from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface MenuItem {
  label?: string;
  icon?: ComponentType;
  action?: () => void;
  danger?: boolean;
  accent?: boolean;
  bold?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
  checked?: boolean;
  disabled?: boolean;
}

export interface FileMenuParams {
  registeredTags: string[];
  currentFileTags: string[];
  onOpenInNewTab: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

/**
 * サイドバーとタブで共通して使用する「ファイル操作」のメニュー項目を生成します
 */
export function buildCommonFileMenu(params: FileMenuParams): MenuItem[] {
  const items: MenuItem[] = [];

  items.push({
    label: '新しいタブで開く',
    action: params.onOpenInNewTab
  });

  items.push({ divider: true });

  // タグ追加
  items.push({
    label: 'タグを挿入',
    icon: Tag,
    submenu: params.registeredTags.length > 0 
      ? params.registeredTags.map(tag => ({
          label: tag,
          action: () => params.onAddTag(tag)
        }))
      : [{ label: 'タグ未登録', disabled: true }]
  });

  // タグ削除
  items.push({
    label: 'タグを削除',
    icon: Tag,
    submenu: params.currentFileTags.length > 0 
      ? params.currentFileTags.map(tag => ({
          label: tag,
          checked: true,
          danger: true,
          action: () => params.onRemoveTag(tag)
        }))
      : [{ label: 'タグなし', disabled: true }]
  });

  items.push({ divider: true });

  return items;
}


export interface TreeNodeMenuParams {
  node: any;
  isPinned: boolean;
  sortBy: string;
  sortOrder: string;
  registeredTags: string[];
  currentFileTags: string[];
  actions: {
    openInNewTab: () => void;
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
    togglePin: () => void;
    editSmartFolder: () => void;
    renameFolder: () => void;
    createNewFile: () => void;
    setSort: (by: string, order: string) => void;
    openExplorer: () => void;
    requestCategoryEdit: () => void;
    removeNode: () => void;
  }
}

/**
 * サイドバーのツリー用右クリックメニューを構築します
 */
export function buildTreeNodeMenu(params: TreeNodeMenuParams): MenuItem[] {
  const { node, isPinned, sortBy, sortOrder, actions } = params;
  const items: MenuItem[] = [];

  if (node.type === 'File') {
    items.push(...buildCommonFileMenu({
      registeredTags: params.registeredTags,
      currentFileTags: params.currentFileTags,
      onOpenInNewTab: actions.openInNewTab,
      onAddTag: actions.addTag,
      onRemoveTag: actions.removeTag
    }));
  }

  items.push({
    label: isPinned ? 'ピン留め解除' : 'ピン留め',
    icon: isPinned ? PinOff : Pin,
    accent: true,
    action: actions.togglePin
  });

  if (node.type === 'Folder' && !node.is_virtual_wrapper) {
    if (node.smart_rules) {
      items.push({ label: '条件を編集', icon: Search, action: actions.editSmartFolder });
    } else {
      items.push({ label: '表示名を変更', icon: Pencil, action: actions.renameFolder });
      if (node.original_path) items.push({ label: '新規ファイル作成', icon: FileText, action: actions.createNewFile });
    }
    
    items.push({
      label: 'ソート順変更', icon: ArrowUpDown, submenu: [
        { label: '昇順', checked: sortOrder !== 'desc', action: () => actions.setSort(sortBy, 'asc') },
        { label: '降順', checked: sortOrder === 'desc', action: () => actions.setSort(sortBy, 'desc') },
        { divider: true },
        { label: '名前', checked: sortBy === 'name', action: () => actions.setSort('name', sortOrder) },
        { label: '作成日', checked: sortBy === 'created', action: () => actions.setSort('created', sortOrder) },
        { label: '更新日', checked: sortBy === 'modified', action: () => actions.setSort('modified', sortOrder) },
      ]
    });
    items.push({ divider: true });
  }

  if (node.type === 'Folder' && node.original_path) items.push({ label: 'エクスプローラーで開く', icon: ExternalLink, action: actions.openExplorer });
  if (!node.is_virtual_wrapper) {
    items.push({ label: 'カテゴリを設定', icon: Layers, action: actions.requestCategoryEdit });
    items.push({ label: 'リストから削除', danger: true, action: actions.removeNode });
  }

  return items;
}