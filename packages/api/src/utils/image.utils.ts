import * as sharp from 'sharp';

/**
 * Generates a thumbnail data URL from an image buffer
 * @param buffer - The image buffer to generate thumbnail from
 * @param maxWidth - Maximum width of thumbnail (default: 400)
 * @param maxHeight - Maximum height of thumbnail (default: 400)
 * @returns A promise that resolves to a data URL string
 */
export async function generateThumbnailDataUrl(
    buffer: Buffer,
    maxWidth = 400,
    maxHeight = 400,
): Promise<string> {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    const thumbnailBuffer = await image.resize(maxWidth, maxHeight, { fit: 'inside' }).toBuffer();
    return `data:image/${metadata.format};base64,${thumbnailBuffer.toString('base64')}`;
}
