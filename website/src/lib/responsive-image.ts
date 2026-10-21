import manifest from '../generated/images.json';
const images = manifest as Record<string, { srcset: string }>;
export const cardSizes = '(max-width: 600px) 90vw, (max-width: 1000px) 44vw, 28vw';
export const detailSizes = '(max-width: 700px) 90vw, 50vw';
export const imageSources = (src: string) => images[src]?.srcset;
export function setResponsiveImage(image: HTMLImageElement, src: string, sizes = detailSizes) {
  image.srcset = imageSources(src) || '';
  image.sizes = sizes;
  image.src = src;
}
