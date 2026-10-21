import type { Product } from './product';
export type GalleryImage = { src: string; alt: string; illustration?: boolean; fallback: string };
const unavailable = '/images/photo-unavailable.svg';
export function gallery(product: Product, colour = product.attributes.color?.[0]): GalleryImage[] {
  const variant = product.colour_variants?.find((v) => v.colour === colour);
  const fallback =
    product.illustration_fallback !== false && variant ? variant.illustration.src : unavailable;
  const photos = variant ? variant.photos : product.images;
  if (photos.length) return photos.map((p) => ({ ...p, fallback }));
  return [
    {
      src: fallback,
      alt: fallback === unavailable ? 'Product photo coming soon' : variant!.illustration.alt,
      illustration: fallback !== unavailable,
      fallback: unavailable,
    },
  ];
}
