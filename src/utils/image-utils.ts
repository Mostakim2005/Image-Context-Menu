import type { SupportedImageFormat } from '../types';

const SUPPORTED_FORMATS = new Set<SupportedImageFormat>(['jpg', 'jpeg', 'png', 'webp']);

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export function isSupportedCompressionFormat(extension: string): extension is SupportedImageFormat {
  return SUPPORTED_FORMATS.has(extension.toLowerCase() as SupportedImageFormat);
}

export function isImageExtension(extension: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(extension.toLowerCase());
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'Unknown size';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatSavedBytes(bytes: number): string {
  return bytes > 0 ? `Saved ${formatBytes(bytes)}` : 'No size reduction';
}

export function percentSaved(original: number, output: number): number {
  if (original <= 0 || output >= original) return 0;
  return Math.round(((original - output) / original) * 100);
}

export function sanitizeBaseName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
}

export function hasExtension(value: string): boolean {
  return /\.[^./\\]+$/.test(value);
}
