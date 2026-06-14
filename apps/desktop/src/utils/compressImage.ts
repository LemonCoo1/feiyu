const DEFAULT_MAX_SIZE = 1920; // 长边最大像素
const DEFAULT_QUALITY = 0.8;   // JPEG/WebP 压缩质量
const MIN_SIZE = 500 * 1024;   // 小于 500KB 不压缩

export interface CompressOptions {
  maxSize?: number;
  quality?: number;
}

/**
 * 压缩图片文件，返回新的 File 对象。
 * 仅处理 JPEG/PNG/WEBP；GIF/SVG/过小文件直接返回原文件。
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxSize = DEFAULT_MAX_SIZE, quality = DEFAULT_QUALITY } = options;

  // 跳过不需要压缩的格式
  if (
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    file.size < MIN_SIZE
  ) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // 等比缩小
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 优先用 WebP，回退 JPEG
  const outputType = "image/webp";
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outputType, quality)
  );

  if (!blob || blob.size >= file.size) {
    // 压缩后反而更大，返回原文件
    return file;
  }

  const ext = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${ext}.webp`, { type: outputType });
}
