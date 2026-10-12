// Profile photo helper: turns a picked image file into a SMALL text ("data:image/jpeg;base64,...").
// The picture is cropped to a square, shrunk to 160 x 160 px and saved as a low-quality JPEG,
// so the stored text is only a few KB (it is saved inside the profile, and synced with Firebase).
const SIZE = 160;              // width and height in pixels
const START_QUALITY = 0.6;     // 0 (tiny, blurry) .. 1 (big, sharp)
const MIN_QUALITY = 0.3;
const MAX_TEXT_LENGTH = 14000; // keep the text under ~10 KB

export function fileToSmallDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const context = canvas.getContext('2d');

        // crop the biggest centred square out of the picture
        const side = Math.min(image.width, image.height);
        const cropX = (image.width - side) / 2;
        const cropY = (image.height - side) / 2;
        context.fillStyle = '#ffffff'; // JPEG has no transparency
        context.fillRect(0, 0, SIZE, SIZE);
        context.drawImage(image, cropX, cropY, side, side, 0, 0, SIZE, SIZE);

        // lower the quality step by step until the text is small enough
        let quality = START_QUALITY;
        let text = canvas.toDataURL('image/jpeg', quality);
        while (text.length > MAX_TEXT_LENGTH && quality > MIN_QUALITY) {
          quality -= 0.1;
          text = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(text);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

/** Is this text a usable web address for an image? */
export function isImageUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim());
}
