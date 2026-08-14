import { Modal, type App } from 'obsidian';

export class ConfirmationModal extends Modal {
  constructor(
    app: App,
    private readonly titleText: string,
    private readonly message: string,
    private readonly confirmText: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('image-context-confirmation-modal');

    contentEl.createEl('h2', { text: this.titleText });
    contentEl.createEl('p', { text: this.message });

    const buttons = contentEl.createDiv({ cls: 'image-context-modal-buttons' });
    const cancel = buttons.createEl('button', { text: 'Cancel' });
    const confirm = buttons.createEl('button', { text: this.confirmText, cls: 'mod-warning' });

    cancel.addEventListener('click', () => this.close());
    confirm.addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
