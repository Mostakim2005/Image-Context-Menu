import { Notice } from 'obsidian';

export class ClipboardService {

  async copyImageAsJpeg(image: HTMLImageElement): Promise<void> {
    const blob = await this.imageToJpeg(image);
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Image clipboard access is unavailable.');
    }

    await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': blob })]);
  }

  async writeText(text: string, successMessage: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    new Notice(successMessage);
  }

  private imageToJpeg(image: HTMLImageElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.body.createEl('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        canvas.remove();
        reject(new Error('Canvas rendering is unavailable.'));
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        canvas.remove();
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the image as JPEG.'));
      }, 'image/jpeg', 0.9);
    });
  }
}

