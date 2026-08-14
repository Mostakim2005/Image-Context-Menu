import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import type { ImageContextSettings } from './types';

export const DEFAULT_SETTINGS: ImageContextSettings = {
  sizeThresholdKB: 300,
  jpegQuality: 70,
  confirmDestructiveActions: false,
  showProgress: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeSettings(data: unknown): ImageContextSettings {
  if (!isRecord(data)) return { ...DEFAULT_SETTINGS };

  return {
    sizeThresholdKB: Math.round(clampNumber(data.sizeThresholdKB, DEFAULT_SETTINGS.sizeThresholdKB, 1, 1024 * 1024)),
    jpegQuality: Math.round(clampNumber(data.jpegQuality, DEFAULT_SETTINGS.jpegQuality, 1, 100)),
    confirmDestructiveActions:
      typeof data.confirmDestructiveActions === 'boolean'
        ? data.confirmDestructiveActions
        : DEFAULT_SETTINGS.confirmDestructiveActions,
    showProgress:
      typeof data.showProgress === 'boolean' ? data.showProgress : DEFAULT_SETTINGS.showProgress,
  };
}

export async function loadSettings(plugin: Plugin): Promise<ImageContextSettings> {
  const data = (await plugin.loadData()) as unknown;
  return normalizeSettings(data);
}

export class ImageContextSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: Plugin & ImageContextPluginLike) {
    super(app, plugin as Plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('image-context-settings');

    new Setting(containerEl).setName('Compression').setHeading();

    new Setting(containerEl)
      .setName('Size threshold')
      .setDesc('Only compress images larger than this size.')
      .addText((text) => {
        text
          .setPlaceholder('300')
          .setValue(String(this.plugin.settings.sizeThresholdKB))
          .onChange((value) => {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed) || parsed < 1) return;
            this.plugin.settings.sizeThresholdKB = Math.min(parsed, 1024 * 1024);
            void this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('JPEG quality')
      .setDesc('Quality used when compressing JPEG images. Higher values preserve more detail.')
      .addSlider((slider) => {
        slider
          .setLimits(1, 100, 1)
          .setValue(this.plugin.settings.jpegQuality)
          .setDynamicTooltip()
          .onChange((value) => {
            this.plugin.settings.jpegQuality = Math.round(value);
            void this.plugin.saveSettings();
          });
      });

    new Setting(containerEl).setName('Safety').setHeading();

    new Setting(containerEl)
      .setName('Confirm destructive actions')
      .setDesc('Ask before replacing an existing image during compression.')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.confirmDestructiveActions).onChange((value) => {
          this.plugin.settings.confirmDestructiveActions = value;
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Show progress')
      .setDesc('Show a compact progress indicator during image compression.')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showProgress).onChange((value) => {
          this.plugin.settings.showProgress = value;
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName('Supported formats').setHeading();
    containerEl.createEl('p', {
      text: 'JPEG, PNG, and WebP can be safely recompressed without changing their file extension. GIF and SVG are left untouched to avoid losing animation or vector data.',
      cls: 'setting-item-description',
    });
  }
}

export interface ImageContextPluginLike {
  settings: ImageContextSettings;
  saveSettings(): Promise<void>;
}
