// Gallery categories, in the fixed display order used everywhere.
export const GALLERY_CATEGORIES = [
  { key: 'sourcing', label: 'Sourcing', step: 'Sourced', blurb: 'From the Bodi, Theni and Idukki growing belt' },
  { key: 'grading', label: 'Grading', step: 'Graded', blurb: 'Sorted by size and colour' },
  { key: 'samples', label: 'Samples', step: 'Sampled', blurb: 'Samples sent first, so you can check the grade before you order' },
  { key: 'packing', label: 'Packing', step: 'Packed', blurb: 'Sealed in inner pouches, then packed in cartons' },
  { key: 'dispatch', label: 'Dispatch', step: 'Dispatched', blurb: 'Delivered across India' },
];

export const categoryLabel = (key) => GALLERY_CATEGORIES.find((c) => c.key === key)?.label || key;

// Cloudinary delivery transforms: insert after "/upload/". Non-Cloudinary URLs pass through.
const withTransform = (url, transform) => {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
};

export const optimizedImageUrl = (url, width = 800) => withTransform(url, `f_auto,q_auto,w_${width},c_limit`);

// Videos: q_auto and a normalised .mp4 extension so .mov uploads play in every browser.
export const optimizedVideoUrl = (url) => {
  const transformed = withTransform(url, 'q_auto');
  return transformed ? transformed.replace(/\.mov$/i, '.mp4') : transformed;
};
