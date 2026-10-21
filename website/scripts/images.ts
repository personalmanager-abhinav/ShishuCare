import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Product } from '../src/lib/product';

export async function generateImages(products: Product[], publicRoot = 'public') {
  const sources = new Set(products.filter(p => p.status === 'active').flatMap(p => [
    ...p.images, ...(p.colour_variants || []).flatMap(v => v.photos),
  ]).map(p => p.src).filter(src => /\.(png|jpe?g|webp|avif)$/i.test(src)));
  const manifest: Record<string, { srcset: string }> = {};
  await mkdir(`${publicRoot}/images/generated`, { recursive: true });
  for (const src of sources) {
    const bytes = await readFile(`${publicRoot}${src}`);
    const hash = createHash('sha256').update(bytes).update('webp-82-v1').digest('hex').slice(0, 20);
    const metadata = await sharp(bytes).metadata();
    const originalWidth = metadata.autoOrient.width;
    const widths = [...new Set([320, 640, 960, 1280].map(w => Math.min(w, originalWidth)))];
    const variants = [];
    for (const width of widths) {
      const name = `/images/generated/${hash}-${width}.webp`;
      await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${publicRoot}${name}`);
      variants.push(`${name} ${width}w`);
    }
    manifest[src] = { srcset: variants.join(', ') };
  }
  return manifest;
}
