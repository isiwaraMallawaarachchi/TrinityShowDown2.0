const compressionThreshold = 384 * 1024;
const preferredLongEdge = 2048;
const maxLongEdge = 4096;

async function optimizeImage(file, field) {
  if (file.size <= compressionThreshold) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    // Keep narrow documents wide enough to read, within the upload size in pixels.
    const scale = Math.min(1, maxLongEdge / longEdge, Math.max(preferredLongEdge / longEdge, 1000 / shortEdge));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;

    const transparentLogo = field === 'teamLogo' && file.type !== 'image/jpeg';
    if (!transparentLogo) {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const type = transparentLogo ? 'image/webp' : 'image/jpeg';
    const optimized = await new Promise(resolve => canvas.toBlob(resolve, type, 0.86));
    canvas.width = 0;
    if (!optimized?.size || optimized.size >= file.size) return file;
    const extension = optimized.type === 'image/webp' ? 'webp' : optimized.type === 'image/png' ? 'png' : 'jpg';
    return new File([optimized], `${field}.${extension}`, { type: optimized.type });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareRegistrationImages(data, signal) {
  for (const [field, value] of [...data]) {
    signal.throwIfAborted();
    if (!(value instanceof File) || !value.size) continue;
    data.set(field, await optimizeImage(value, field));
  }
  signal.throwIfAborted();
}
