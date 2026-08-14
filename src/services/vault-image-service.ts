import { TFile, type App } from 'obsidian';
import { getExtension } from '../utils/image-utils';
import type { ImageInfo, ImageTarget } from '../types';

export class VaultImageService {
  constructor(private readonly app: App) {}

  getTargetFromImage(img: HTMLImageElement): ImageTarget {
    const source = img.getAttribute('src') ?? '';
    const embed = img.closest<HTMLElement>('.internal-embed');

    if (embed) {
      const path = embed.getAttribute('data-path');
      if (path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          return {
            file,
            fileName: file.name,
            source,
            isVaultImage: true,
          };
        }
      }
    }

    const pathFromSource = this.getVaultPathFromSource(source);
    if (pathFromSource) {
      const file = this.app.vault.getAbstractFileByPath(pathFromSource);
      if (file instanceof TFile) {
        return {
          file,
          fileName: file.name,
          source,
          isVaultImage: true,
        };
      }
    }

    return {
      file: null,
      fileName: null,
      source,
      isVaultImage: false,
    };
  }

  getImageInfo(img: HTMLImageElement, file: TFile | null): ImageInfo {
    let sizeBytes: number | null = null;

    if (file) {
      try {
        sizeBytes = file.stat.size;
      } catch {
        sizeBytes = null;
      }
    }

    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes,
      fileName: file?.name ?? (img.alt || 'image'),
      extension: file ? getExtension(file.name) : null,
    };
  }

  async renameFile(file: TFile, newPath: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(newPath);
    if (existing && existing !== file) {
      throw new Error('A file already exists at that path.');
    }

    await this.app.fileManager.renameFile(file, newPath);
  }

  private getVaultPathFromSource(source: string): string | null {
    if (!source || source.startsWith('data:') || /^https?:\/\//i.test(source)) return null;

    try {
      const url = new URL(source, window.location.href);
      const decodedPath = decodeURIComponent(url.pathname);
      const resourceMarker = '/app/';
      const markerIndex = decodedPath.indexOf(resourceMarker);
      if (markerIndex !== -1) {
        const candidate = decodedPath.slice(markerIndex + resourceMarker.length);
        return candidate.replace(/^\//, '');
      }
    } catch {
      // Fall through to the simple relative-path check.
    }

    const candidate = decodeURIComponent(source.split('?')[0]?.split('#')[0] ?? '').replace(/^\//, '');
    return candidate || null;
  }
}
