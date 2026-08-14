import { TFile, type App } from 'obsidian';
import type { CompressionResult, ImageContextSettings, SupportedImageFormat } from '../types';
import { getExtension, isSupportedCompressionFormat } from '../utils/image-utils';
import { getMimeType } from '../utils/mime-utils';

export class CompressionService {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => ImageContextSettings,
  ) {}

  async compressFile(file: TFile): Promise<CompressionResult> {
    const originalBytes = file.stat.size;
    const settings = this.getSettings();
    const thresholdBytes = settings.sizeThresholdKB * 1024;
    const extension = getExtension(file.name);

    if (originalBytes <= thresholdBytes) {
      return {
        status: 'skipped',
        originalBytes,
        outputBytes: originalBytes,
        savedBytes: 0,
        reason: 'Below the configured size threshold.',
      };
    }

    if (!isSupportedCompressionFormat(extension)) {
      return {
        status: 'unsupported',
        originalBytes,
        outputBytes: originalBytes,
        savedBytes: 0,
        reason: 'This image format is not safely recompressed without changing its format or data characteristics.',
      };
    }

    try {
      const arrayBuffer = await this.app.vault.readBinary(file);
      const blob = new Blob([arrayBuffer], { type: getMimeType(extension) });
      const image = await this.loadImage(blob);
      const output = await this.imageToBlob(image, extension, settings.jpegQuality / 100);

      if (!output) {
        return {
          status: 'error',
          originalBytes,
          outputBytes: originalBytes,
          savedBytes: 0,
          reason: 'The browser could not encode the image.',
        };
      }

      if (output.size >= originalBytes) {
        return {
          status: 'skipped',
          originalBytes,
          outputBytes: originalBytes,
          savedBytes: 0,
          reason: 'Compression did not make the file smaller.',
        };
      }

      await this.app.vault.modifyBinary(file, await output.arrayBuffer());

      return {
        status: 'compressed',
        originalBytes,
        outputBytes: output.size,
        savedBytes: originalBytes - output.size,
      };
    } catch (error) {
      return {
        status: 'error',
        originalBytes,
        outputBytes: originalBytes,
        savedBytes: 0,
        reason: error instanceof Error ? error.message : 'Unknown compression error.',
      };
    }
  }

  private loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode the image.'));
      };
      image.src = url;
    });
  }

  private imageToBlob(
    image: HTMLImageElement,
    format: SupportedImageFormat,
    quality: number,
  ): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const canvas = document.body.createEl('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      if (canvas.width <= 0 || canvas.height <= 0) {
        canvas.remove();
        reject(new Error('Image has invalid dimensions.'));
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        canvas.remove();
        reject(new Error('Canvas rendering is unavailable.'));
        return;
      }

      context.drawImage(image, 0, 0);
      const mimeType = format === 'png' ? 'image/png' : getMimeType(format);
      const effectiveQuality = format === 'png' ? undefined : quality;

      canvas.toBlob((blob) => {
        canvas.remove();
        resolve(blob);
      }, mimeType, effectiveQuality);
    });
  }
}
