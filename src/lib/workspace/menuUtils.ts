// 右クリックメニューを表示するデータ構造を定義し、ファイル共通のアクションを生成
import { Tag } from 'lucide-svelte';
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