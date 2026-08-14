import type { ProgressHandle } from '../types';

export function createProgressOverlay(container: HTMLElement): ProgressHandle {
  const root = container.createDiv({ cls: 'image-context-progress' });
  const header = root.createDiv({ cls: 'image-context-progress__header' });
  const text = header.createSpan({ cls: 'image-context-progress__text', text: 'Starting…' });
  const value = header.createSpan({ cls: 'image-context-progress__value', text: '0%' });
  const track = root.createDiv({ cls: 'image-context-progress__track' });
  const fill = track.createDiv({ cls: 'image-context-progress__fill' });

  return {
    update(percent: number, message: string): void {
      const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
      text.setText(message);
      value.setText(`${safePercent}%`);
      fill.style.width = `${safePercent}%`;
    },
    remove(): void {
      root.remove();
    },
  };
}
