import sharp from 'sharp';

const MAX_WIDTH = 800;
const JPEG_QUALITY = 85;
const MAX_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Resize a base64 data URI image for LLM processing.
 * - Scales down to max 800px width (preserving aspect ratio)
 * - Converts to JPEG at 85% quality
 * - Ensures output < 1MB
 * @returns Resized base64 data URI (data:image/jpeg;base64,...)
 * @throws Error if image is invalid or cannot be processed
 */
export async function resizeImageForLLM(
  imageBase64: string,
): Promise<string> {
  // Extract base64 data from data URI
  const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    throw new Error(
      'Invalid image format: must be a base64 data URI (jpeg or png)',
    );
  }

  const [, format, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('Invalid image data: empty buffer');
  }

  try {
    const resized = await sharp(buffer)
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    if (resized.length > MAX_SIZE_BYTES) {
      throw new Error(
        `Resized image too large (${(resized.length / 1024 / 1024).toFixed(2)}MB). Max allowed: 1MB`,
      );
    }

    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes('too large')) {
      throw error;
    }
    throw new Error(
      `Image resize failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
