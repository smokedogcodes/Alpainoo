/** Browser-side image resize/compress before admin upload (D1 row limit ~2 MB). */

export const UPLOAD_MAX_EDGE = 1200;
export const UPLOAD_MAX_BYTES = 500 * 1024;
export const UPLOAD_MIME = "image/webp";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compress failed"))),
      UPLOAD_MIME,
      quality
    );
  });
}

/**
 * Resize to max edge and encode as WebP under UPLOAD_MAX_BYTES.
 * GIFs fall through as-is only if already small; otherwise first frame via canvas.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > UPLOAD_MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > UPLOAD_MAX_BYTES) {
    // Last resort: shrink further
    const shrink = Math.sqrt(UPLOAD_MAX_BYTES / blob.size) * 0.9;
    canvas.width = Math.max(1, Math.round(width * shrink));
    canvas.height = Math.max(1, Math.round(height * shrink));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, 0.7);
  }

  if (blob.size > UPLOAD_MAX_BYTES) {
    throw new Error(
      `Image still too large after compress (${Math.round(blob.size / 1024)} KB). Try a smaller photo.`
    );
  }

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: UPLOAD_MIME, lastModified: Date.now() });
}
