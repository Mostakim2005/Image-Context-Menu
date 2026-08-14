import { Menu, Notice, type MenuItem } from 'obsidian';
import type { ImageTarget } from '../types';

export interface ImageContextMenuActions {
  copyAsJpeg(): void;
  share(): void;
  showInfo(): void;
  rename(): void;
  compress(): void;
  resize(): void;
  copyEmbed(): void;
  copyExternalLink(): void;
  openImage(): void;
}

export function showImageContextMenu(
  event: MouseEvent,
  target: ImageTarget,
  actions: ImageContextMenuActions,
): void {
  const menu = new Menu();

  menu.addItem((item) => addAction(item, 'Copy as JPEG', 'image-file', () => actions.copyAsJpeg()));
  menu.addItem((item) => addAction(item, 'Copy embed link', 'file-text', () => actions.copyEmbed()));

  if (target.isVaultImage && target.file) {
    menu.addItem((item) => addAction(item, 'Share image', 'share-2', () => actions.share()));
    menu.addSeparator();
    menu.addItem((item) => addAction(item, 'Resize image', 'maximize-2', () => actions.resize()));
    menu.addItem((item) => addAction(item, 'Compress image', 'file-down', () => actions.compress()));
    menu.addItem((item) => addAction(item, 'Rename image', 'pencil', () => actions.rename()));
  } else if (/^https?:\/\//i.test(target.source)) {
    menu.addItem((item) => addAction(item, 'Copy external link', 'external-link', () => actions.copyExternalLink()));
  }

  menu.addSeparator();
  menu.addItem((item) => addAction(item, 'Image information', 'info', () => actions.showInfo()));
  menu.addItem((item) => addAction(item, 'Open image', 'maximize', () => actions.openImage()));

  menu.showAtPosition({ x: event.pageX, y: event.pageY });
}

function addAction(
  item: MenuItem,
  title: string,
  icon: string,
  callback: () => void,
): MenuItem {
  return item.setTitle(title).setIcon(icon).onClick(() => {
    try {
      callback();
    } catch (error) {
      console.error(`Image context action failed: ${title}`, error);
      new Notice(`${title} failed.`);
    }
  });
}
