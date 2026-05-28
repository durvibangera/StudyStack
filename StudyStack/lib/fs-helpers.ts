import fs from 'fs';
import path from 'path';

/**
 * Save base64 image to local /public/campaign-images/ directory
 * @param base64Data - Base64 encoded image data
 * @param filePrefix - Prefix for the image file (used for folder organization)
 * @param ext - File extension
 * @returns Object with filename and local URL
 */
export async function saveBase64Image(base64Data: string, filePrefix = 'image', ext = 'png') {
  console.log('[fs-helpers] saveBase64Image called:', {
    filePrefix,
    ext,
    dataLength: base64Data?.length || 0,
  });

  try {
    // Save to public/campaign-images/ so Next.js can serve them statically
    const dir = path.join(process.cwd(), 'public', 'campaign-images', filePrefix);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${filePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const fullPath = path.join(dir, filename);

    // Write base64 data to file
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(fullPath, buffer);

    // URL path that Next.js can serve from /public
    const publicUrl = `/campaign-images/${filePrefix}/${filename}`;

    console.log('[fs-helpers] Image saved locally:', {
      filename,
      fullPath,
      publicUrl,
    });

    return {
      filename,
      fullPath,
      cloudinaryUrl: publicUrl, // keep same key so downstream code works unchanged
      publicId: filename,
    };
  } catch (error) {
    console.error('[fs-helpers] Failed to save image:', error);
    throw error;
  }
}
