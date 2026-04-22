/**
 * Returns the best displayable image URL for a product.
 *
 * Priority order:
 * 1. First image in media_paths (by extension or Cloudinary image path)
 * 2. Cloudinary video poster (extracted via Cloudinary URL transformation)
 * 3. product.image_url (if it's not a video)
 * 4. null → caller should show a leaf placeholder
 */
export const getProductImage = (product) => {
  if (product.media_paths?.length > 0) {
    // Look for an image URL first
    const imageUrl = product.media_paths.find(url =>
      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) ||
      (url.includes('res.cloudinary.com') && url.includes('/image/upload/'))
    );
    if (imageUrl) return imageUrl;

    // Fall back to extracting a poster frame from a Cloudinary video
    const videoUrl = product.media_paths.find(url =>
      url.includes('/video/upload/') ||
      /\.(mp4|mov)(\?|$)/i.test(url)
    );
    if (videoUrl) {
      return videoUrl
        .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_80/')
        .replace(/\.(mp4|mov)(\?|$)/i, '.jpg');
    }
  }

  // Fall back to image_url if it's not pointing at a video
  if (product.image_url && !product.image_url.includes('/video/')) {
    return product.image_url;
  }

  return null;
};

/** True if this URL points at a video (mp4/mov or Cloudinary video upload) */
export const isVideoUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || url.includes('/video/upload/');
};
