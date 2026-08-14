import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  type Editor,
  type CachedMetadata,
} from 'obsidian';
import type { CodeMirrorViewLike, BulkCompressionResult, ImageContextSettings } from './types';
import { DEFAULT_SETTINGS, ImageContextSettingTab, loadSettings } from './settings';
import { CompressionService } from './services/compression-service';
import { ClipboardService } from './services/clipboard-service';
import { VaultImageService } from './services/vault-image-service';
import { ConfirmationModal } from './ui/confirmation-modal';
import { InputModal } from './ui/input-modal';
import { showImageContextMenu } from './ui/image-context-menu';
import { createProgressOverlay } from './ui/progress-overlay';
import { formatBytes, getExtension, hasExtension, isImageExtension, percentSaved, sanitizeBaseName } from './utils/image-utils';
import { normalizeResizeValue, isValidResizeValue } from './utils/validation';
import { normalizePath } from 'obsidian';

export default class ImageContextPlugin extends Plugin {
  settings: ImageContextSettings = { ...DEFAULT_SETTINGS };

  private compressionService!: CompressionService;
  private clipboardService!: ClipboardService;
  private vaultImageService!: VaultImageService;

  async onload(): Promise<void> {
    this.settings = await loadSettings(this);
    this.compressionService = new CompressionService(this.app, () => this.settings);
    this.clipboardService = new ClipboardService();
    this.vaultImageService = new VaultImageService(this.app);

    this.addSettingTab(new ImageContextSettingTab(this.app, this));

    this.addCommand({
      id: 'compress-note-images',
      name: 'Compress images in current note',
      checkCallback: (checking) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView?.file) return false;
        if (!checking) void this.compressCurrentNoteImages(activeView);
        return true;
      },
    });

    this.addRibbonIcon('image-file', 'Compress images in current note', () => {
      void this.compressCurrentNoteImages();
    });

    this.registerDomEvent(document, 'contextmenu', (event) => {
      this.handleContextMenu(event);
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private handleContextMenu(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    if (event.defaultPrevented) return;

    const image = event.target.closest('img');
    if (!(image instanceof HTMLImageElement)) return;
    if (image.closest('.menu, .modal, .image-context-progress')) return;

    const target = this.vaultImageService.getTargetFromImage(image);
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.editor;

    event.preventDefault();
    event.stopPropagation();

    showImageContextMenu(event, target, {
      copyAsJpeg: () => {
        void this.copyAsJpeg(image);
      },
      copyEmbed: () => {
        void this.copyEmbedLink(target);
      },
      copyExternalLink: () => {
        void this.copyExternalLink(target.source);
      },
      share: () => {
        if (target.file) void this.shareImage(target.file);
      },
      showInfo: () => {
        void this.showImageInfo(image, target.file);
      },
      rename: () => {
        if (target.file) this.renameImage(target.file);
      },
      compress: () => {
        if (target.file) void this.compressContextImage(target.file);
      },
      resize: () => {
        if (target.file && editor) this.resizeImage(editor, image);
      },
      openImage: () => {
        if (target.file) {
          void this.app.workspace.openLinkText(target.file.path, '', true);
        } else if (target.source) {
          window.open(target.source, '_blank', 'noopener');
        }
      },
    });
  }

  private async compressCurrentNoteImages(view?: MarkdownView): Promise<void> {
    const activeView = view ?? this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file) {
      new Notice('Open a note first.');
      return;
    }

    const cache = this.app.metadataCache.getFileCache(activeView.file);
    if (!cache) {
      new Notice('The note metadata is not available yet.');
      return;
    }

    const imageFiles = this.getUniqueImageFilesFromEmbeds(cache.embeds ?? [], activeView.file.path);
    if (imageFiles.length === 0) {
      new Notice('No image embeds found in this note.');
      return;
    }

    const progress = this.settings.showProgress ? createProgressOverlay(activeView.contentEl) : null;
    const result: BulkCompressionResult = {
      total: imageFiles.length,
      compressed: 0,
      skipped: 0,
      unsupported: 0,
      failed: 0,
      originalBytes: 0,
      outputBytes: 0,
    };

    try {
      for (let index = 0; index < imageFiles.length; index += 1) {
        const file = imageFiles[index];
        if (!file) continue;

        progress?.update((index / imageFiles.length) * 100, `Processing image ${index + 1} of ${imageFiles.length}`);

        const compression = await this.compressionService.compressFile(file);
        result.originalBytes += compression.originalBytes;
        result.outputBytes += compression.outputBytes;

        switch (compression.status) {
          case 'compressed':
            result.compressed += 1;
            break;
          case 'unsupported':
            result.unsupported += 1;
            break;
          case 'skipped':
            result.skipped += 1;
            break;
          case 'error':
            result.failed += 1;
            break;
        }
      }

      progress?.update(100, 'Optimization complete');
      window.setTimeout(() => progress?.remove(), 1000);

      const saved = result.originalBytes - result.outputBytes;
      const summary = `${result.compressed} compressed, ${result.skipped} skipped, ${result.unsupported} unsupported, ${result.failed} failed.`;
      new Notice(`Processed ${result.total} image(s). ${summary} ${formatBytes(saved)} saved.`);
    } catch (error) {
      progress?.remove();
      console.error('Bulk image compression failed', error);
      new Notice('Image compression failed.');
    }
  }

  private getUniqueImageFilesFromEmbeds(
    embeds: NonNullable<CachedMetadata['embeds']>,
    sourcePath: string,
  ): TFile[] {
    const files = new Map<string, TFile>();

    for (const embed of embeds) {
      const resolved = this.app.metadataCache.getFirstLinkpathDest(embed.link, sourcePath);
      if (!(resolved instanceof TFile)) continue;
      if (!isImageExtension(getExtension(resolved.name))) continue;
      files.set(resolved.path, resolved);
    }

    return [...files.values()];
  }

  private async compressContextImage(file: TFile): Promise<void> {
    const run = async (): Promise<void> => {
      const progress = this.settings.showProgress
        ? createProgressOverlay(this.app.workspace.getActiveViewOfType(MarkdownView)?.contentEl ?? document.body)
        : null;

      try {
        progress?.update(20, 'Compressing image');
        const result = await this.compressionService.compressFile(file);
        progress?.update(100, result.status === 'compressed' ? 'Image compressed' : 'No change needed');
        window.setTimeout(() => progress?.remove(), 900);

        if (result.status === 'compressed') {
          new Notice(`Image compressed. Saved ${formatBytes(result.savedBytes)} (${percentSaved(result.originalBytes, result.outputBytes)}%).`);
        } else if (result.status === 'unsupported') {
          new Notice('This image format is not safely recompressed.');
        } else if (result.status === 'skipped') {
          new Notice('Image is already below the threshold or could not be made smaller.');
        } else {
          new Notice('Compression failed.');
        }
      } catch (error) {
        progress?.remove();
        console.error('Image compression failed', error);
        new Notice('Compression failed.');
      }
    };

    if (!this.settings.confirmDestructiveActions) {
      await run();
      return;
    }

    new ConfirmationModal(
      this.app,
      'Compress image',
      `The image will be replaced only if the compressed version is smaller. The file name and links will remain unchanged.`,
      'Compress',
      () => void run(),
    ).open();
  }

  private async copyAsJpeg(image: HTMLImageElement): Promise<void> {
    try {
      await this.clipboardService.copyImageAsJpeg(image);
      new Notice('Copied image as JPEG.');
    } catch (error) {
      console.error('Copy as JPEG failed', error);
      new Notice('Could not copy the image as JPEG.');
    }
  }

  private async copyEmbedLink(target: ReturnType<VaultImageService['getTargetFromImage']>): Promise<void> {
    try {
      if (target.file) {
        const link = this.app.fileManager.generateMarkdownLink(target.file, this.app.workspace.getActiveFile()?.path ?? '');
        const embed = link.startsWith('!') ? link : `!${link}`;
        await this.clipboardService.writeText(embed, 'Embed link copied.');
        return;
      }

      const alt = target.source ? 'image' : 'image';
      await this.clipboardService.writeText(`![${alt}](${target.source})`, 'Markdown image link copied.');
    } catch (error) {
      console.error('Copy embed link failed', error);
      new Notice('Could not copy the image link.');
    }
  }

  private async copyExternalLink(source: string): Promise<void> {
    try {
      await this.clipboardService.writeText(source, 'External link copied.');
    } catch (error) {
      console.error('Copy external link failed', error);
      new Notice('Could not copy the external link.');
    }
  }

  private async shareImage(file: TFile): Promise<void> {
    try {
      const data = await this.app.vault.readBinary(file);
      const mimeType = this.getMimeType(file.extension);
      const sharedFile = new File([data], file.name, { type: mimeType });

      if (navigator.share && navigator.canShare?.({ files: [sharedFile] })) {
        await navigator.share({ files: [sharedFile], title: file.name });
        return;
      }

      // `App.openWithDefaultApp()` is not part of Obsidian's public TypeScript API.
      // Fall back to opening the image through Obsidian's supported workspace API.
      await this.app.workspace.openLinkText(file.path, '', true);
      new Notice('Native sharing is unavailable, so the image was opened in Obsidian.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Share image failed', error);
      new Notice('Could not share or open the image.');
    }
  }

  private async showImageInfo(image: HTMLImageElement, file: TFile | null): Promise<void> {
    const info = await this.vaultImageService.getImageInfo(image, file);
    const size = formatBytes(info.sizeBytes);
    new Notice(`${info.fileName} · ${info.width} × ${info.height} · ${size}`);
  }

  private renameImage(file: TFile): void {
    const extension = getExtension(file.name);
    const initial = file.basename;

    new InputModal(this.app, 'Rename image', 'New filename', initial, (value) => {
      void this.performRename(file, value, extension);
    }).open();
  }

  private async performRename(file: TFile, value: string, extension: string): Promise<void> {
    const sanitized = sanitizeBaseName(value);
    if (!sanitized) {
      new Notice('The filename cannot be empty.');
      return;
    }

    const withoutExtension = hasExtension(sanitized)
      ? sanitized.replace(new RegExp(`\\.${this.escapeRegExp(extension)}$`, 'i'), '')
      : sanitized;
    const newName = `${withoutExtension}.${extension}`;
    const parentPath = file.parent?.path ?? '';
    const newPath = normalizePath(parentPath ? `${parentPath}/${newName}` : newName);

    if (newPath === file.path) {
      new Notice('The filename is unchanged.');
      return;
    }

    try {
      await this.vaultImageService.renameFile(file, newPath);
      new Notice(`Renamed image to ${newName}. Links were handled by Obsidian.`);
    } catch (error) {
      console.error('Image rename failed', error);
      new Notice(error instanceof Error ? error.message : 'Rename failed.');
    }
  }

  private resizeImage(editor: Editor, image: HTMLImageElement): void {
    new InputModal(this.app, 'Resize image', 'e.g. 300 or 300x200', '', (value) => {
      const normalized = normalizeResizeValue(value);
      if (!isValidResizeValue(normalized)) {
        new Notice('Use a positive width or width × height, such as 300 or 300x200.');
        return;
      }

      try {
        const view = this.getCodeMirrorView(editor);
        const embed = image.closest('.internal-embed');
        if (!view || !embed) {
          new Notice('Resize is available when the image is linked with an Obsidian embed.');
          return;
        }

        const position = view.posAtDOM(embed);
        const line = view.state.doc.lineAt(position);
        const relativePosition = Math.max(0, position - line.from);
        const start = line.text.lastIndexOf('![[', relativePosition);
        const end = line.text.indexOf(']]', relativePosition);

        if (start === -1 || end === -1 || end < start) {
          new Notice('Could not locate the image embed in the note.');
          return;
        }

        const currentEmbed = line.text.slice(start, end + 2);
        const inner = currentEmbed.slice(3, -2);
        const separator = inner.indexOf('|');
        const filePart = separator === -1 ? inner : inner.slice(0, separator);
        const newEmbed = `![[${filePart}|${normalized}]]`;

        editor.replaceRange(
          newEmbed,
          { line: line.number - 1, ch: start },
          { line: line.number - 1, ch: end + 2 },
        );
        new Notice(`Image resized to ${normalized}.`);
      } catch (error) {
        console.error('Image resize failed', error);
        new Notice('Resize failed.');
      }
    }).open();
  }

  private getCodeMirrorView(editor: Editor): CodeMirrorViewLike | null {
    const internalEditor = editor as unknown as { cm?: unknown };
    if (!internalEditor.cm || typeof internalEditor.cm !== 'object') return null;

    const candidate = internalEditor.cm as Partial<CodeMirrorViewLike>;
    if (typeof candidate.posAtDOM !== 'function' || !candidate.state?.doc?.lineAt) return null;
    return candidate as CodeMirrorViewLike;
  }

  private getMimeType(extension: string): string {
    switch (extension.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
