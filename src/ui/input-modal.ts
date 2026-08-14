import { Modal, Notice, type App } from 'obsidian';

export class InputModal extends Modal {
  constructor(
    app: App,
    private readonly titleText: string,
    private readonly placeholder: string,
    private readonly initialValue: string,
    private readonly onSubmit: (value: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('image-context-input-modal');

    contentEl.createEl('h2', { text: this.titleText });
    const input = contentEl.createEl('input', {
      type: 'text',
      placeholder: this.placeholder,
      value: this.initialValue,
    });

    const buttons = contentEl.createDiv({ cls: 'image-context-modal-buttons' });
    const cancel = buttons.createEl('button', { text: 'Cancel' });
    const submit = buttons.createEl('button', { text: 'OK', cls: 'mod-cta' });

    const submitValue = (): void => {
      const value = input.value.trim();
      if (!value) {
        new Notice('Please enter a value.');
        return;
      }
      this.close();
      this.onSubmit(value);
    };

    cancel.addEventListener('click', () => this.close());
    submit.addEventListener('click', submitValue);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submitValue();
      if (event.key === 'Escape') this.close();
    });

    window.setTimeout(() => input.focus(), 10);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
